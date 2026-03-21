# All these libraries will need to be downloaded via pip
from fastapi import FastAPI
from fastapi import Query
from fastapi.middleware.cors import CORSMiddleware
import pandas
from concurrent.futures import ThreadPoolExecutor, as_completed
import os
import re

try:
    from . import dataprocessing as dp
    from .models import Paper
except ImportError:
    import dataprocessing as dp
    from models import Paper

app = FastAPI()

# Configure CORS via BACKEND_CORS_ORIGINS (comma-separated).
allowedOrigins = [o.strip() for o in os.getenv("BACKEND_CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins = allowedOrigins,
    allow_credentials = False,
    allow_methods = ["GET"],
    allow_headers = ["*"],
)

data = dp.dataPreProcessing()


def _previewForLink(link: str) -> str:
    content = dp.scrapePaper(link)
    return content[0] if len(content) > 0 else ""


def _smartOverviewFromTitle(title: str) -> str:
    cleanTitle = " ".join(str(title).split()).strip()
    if not cleanTitle:
        return "Space-biology publication. Open the source link for details or use AI Summary for a deeper breakdown."

    lowered = cleanTitle.lower()

    organismPatterns = [
        (r"\bmice?\b|\bmouse\b", "mouse biology"),
        (r"\brats?\b|\brat\b", "rat biology"),
        (r"\byeast\b", "yeast biology"),
        (r"\barabidopsis\b|\bplant\b", "plant biology"),
        (r"\bhuman\b|\bhumans\b", "human biology"),
        (r"\bbacteria\b|\bbacterial\b|\bmicrobe\b", "microbial biology"),
        (r"\bcell\b|\bcells\b", "cellular systems"),
    ]

    contextPatterns = [
        (r"\bmicrogravity\b|\bspaceflight\b|\borbit\b|\biss\b", "under spaceflight conditions"),
        (r"\bradiation\b", "with radiation exposure"),
        (r"\bgravity\b", "with altered-gravity conditions"),
        (r"\bflight\b", "during mission operations"),
    ]

    methodPatterns = [
        (r"\brna[- ]?seq\b|\btranscriptom", "transcriptomic profiling"),
        (r"\bproteom", "proteomic analysis"),
        (r"\bmetabol", "metabolomic analysis"),
        (r"\bmodel\b|\bsimulation\b", "computational modeling"),
        (r"\bassay\b|\bexperiment\b", "experimental assay data"),
    ]

    outcomePatterns = [
        (r"\bgrowth\b", "growth dynamics"),
        (r"\brepair\b|\bdna\b", "genome stability and repair pathways"),
        (r"\bimmune\b|\binflammation\b", "immune-response signals"),
        (r"\bstress\b|\boxidative\b", "stress-response behavior"),
        (r"\badapt", "adaptive biological responses"),
    ]

    def pick(patterns: list[tuple[str, str]], default: str) -> str:
        for pattern, label in patterns:
            if re.search(pattern, lowered):
                return label
        return default

    organism = pick(organismPatterns, "biological samples")
    context = pick(contextPatterns, "in space-biology settings")
    method = pick(methodPatterns, "study measurements")
    outcome = pick(outcomePatterns, "biological response patterns")

    return (
        f"This publication investigates {organism} {context}, using {method} to characterize {outcome}. "
        f"Focus topic: {cleanTitle}. Open the source link for full methods and results, or use AI Summary for deeper detail."
    )


def formatDFtoPaper(df: pandas.DataFrame) -> list[Paper]:
    papersList = []
    lenPara1 = 50
    for _ , row in df.iterrows():
        para1 = str(row.get("ContentPara1", "")).strip()
        if para1:
            para1 = " ".join(para1.split()[:lenPara1]) + "..."
        else:
            para1 = _smartOverviewFromTitle(str(row.get("Title", "")))

        papersList.append(Paper(
            title = row["Title"],
            url = row["Link"],
            paperID = row["id"],
            contentPara1 = para1
        ))
    return papersList

# Test root path
@app.get("/hello")
def root_path():
    return {"message": "Hello World"}


@app.get("/healthz")
def healthcheck():
    return {"status": "ok"}

@app.get("/papers")
async def root(
    searchQuery: str = "",
    searchNum: int = 4,
    includeContent: bool = Query(False, description = "Whether to scrape linked pages for preview text"),
    contentLimit: int = Query(6, description = "Maximum number of matched papers to scrape when includeContent=true")
):
    if searchNum > 100:
        searchNum = 100

    if searchNum < 1:
        searchNum = 1
    
    matchedPapers = dp.findSearchMatch(searchQuery, data, searchNum)
    matchedPapers = matchedPapers.drop(columns = ["Embedding", "Similarity", "EmbeddingVector"], errors = "ignore")
    matchedPapers["ContentPara1"] = ""

    if includeContent and len(matchedPapers) > 0:
        safeContentLimit = max(1, min(contentLimit, len(matchedPapers), 25))
        previewDF = matchedPapers.head(safeContentLimit).copy()

        previews = {idx: "" for idx in previewDF.index}
        with ThreadPoolExecutor(max_workers = min(8, safeContentLimit)) as executor:
            futureByIndex = {
                executor.submit(_previewForLink, row["Link"]): idx
                for idx, row in previewDF.iterrows()
            }

            for future in as_completed(futureByIndex):
                idx = futureByIndex[future]
                try:
                    previews[idx] = future.result()
                except Exception:
                    previews[idx] = ""

        previewDF["ContentPara1"] = previewDF.index.map(lambda idx: previews.get(idx, ""))

        matchedPapers.loc[previewDF.index, "ContentPara1"] = previewDF["ContentPara1"]

    # Line to generate a summary of text
    # matchedPapers["Summary"] = matchedPapers["Content"].apply(dp.summarizeText)

    return formatDFtoPaper(matchedPapers)
    
@app.get("/summary")
async def summarize_paper(
    link: str = Query(..., description = "URL of the paper to summarize"),
    title: str = Query("", description = "Paper title for fallback summary generation")
):
    content = dp.scrapePaper(link)

    if not content:
        return {
            "url": link,
            "summary": dp.fallbackSummaryFromTitle(title),
            "source": "fallback"
        }

    fullText = " ".join(content)

    # Using the summarisation function from ChatGPTFunctions class
    summary = dp.ChatGPTFunctions.summarizeText(fullText)

    return{
        "url": link,
        "summary": summary,
        "source": "openai" if dp.hasOpenAIKey() else "fallback"
    }

