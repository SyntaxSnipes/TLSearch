# All these libraries will need to be installed via pip
from dotenv import load_dotenv
import pandas as pd
import numpy as np
from bs4 import BeautifulSoup
import requests
from openai import OpenAI
import os
import ast
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from functools import lru_cache

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None


def hasOpenAIKey() -> bool:
    return client is not None

# Function to create word embeddings (Vectors used to represent words as numerical values) using OpenAI API
def makeWordEmbeddings(text: str):
    if client is None:
        raise RuntimeError("OpenAI client is not configured")

    response = client.embeddings.create(
        input = text,
        model = "text-embedding-3-small"
    )
    return response.data[0].embedding


@lru_cache(maxsize = 256)
def makeQueryEmbeddingCached(text: str) -> tuple[float, ...]:
    return tuple(makeWordEmbeddings(text))

class ChatGPTFunctions:
    # Summarise text using ChatGPT
    def summarizeText(text: str):
        if client is None:
            return fallbackSummary(text)

        if _isBlockedText(text):
            return "No direct article text was accessible from the source URL."

        try:
            response = client.chat.completions.create(
                model = "gpt-4o-mini",
                messages = [{"role": "user", "content": f"Summarize the following text into 5 bullet points in a concise, precise manner:\n{text}"}]
            )
            return response.choices[0].message.content
        except Exception:
            return fallbackSummary(text)

    #def answerQuery(text: str, query: str)



# Funtcion to check how similar to words are using their embeddings
def wordSimilarity(wordEmbedding1: list[float], wordEmbedding2: list[float]) -> float:
    return np.dot(wordEmbedding1, wordEmbedding2) / (np.linalg.norm(wordEmbedding1) * np.linalg.norm(wordEmbedding2))


# Function to get all the text from a paper given its URL
def scrapePaper(paperUrl: str, sectionFilter: str = ""):
    pmcText = _scrapePmcAbstract(paperUrl)
    if pmcText:
        return pmcText

    headerData = {"User-Agent": "Mozilla/5.0"}
    try:
        response = requests.get(paperUrl, headers = headerData, timeout = 12)
        response.raise_for_status()
    except Exception:
        # Some scientific sites block basic bots; try a readable-text proxy fallback.
        return _scrapeViaReaderProxy(paperUrl)

    html_content = response.text
    soup = BeautifulSoup(html_content, 'html.parser')

    # Possible section id's, that could contain paper content in the HTML of the website
    possibleSections = [f"abstract{i}"
                        for i in range(11)]
    
    possibleSections.extend([f"Abs{i}"
                             for i in range(11)])

    possibleSections.extend([f"Sec{i}"
                             for i in range(100)])
    
    possibleSections.extend([f"sec{i}"
                             for i in range(100)])

    possibleSections.extend([f"s{i}"
                             for i in range(100)])
    

    textContent = []
    
    tags = soup.find_all(id = possibleSections)
    for tag in tags:
        paragraphs = tag.find_all("p")

        for para in paragraphs:
            cleaned = _cleanText(para.get_text())
            if cleaned:
                textContent.append(cleaned)

    # Fallback for pages that do not expose expected section ids.
    if not textContent:
        containers = [
            soup.find("article"),
            soup.find("main"),
            soup.find(id = "maincontent"),
            soup.find(id = "main-content"),
            soup.find(class_ = "article"),
            soup.find(class_ = "content"),
        ]

        baseContainer = next((c for c in containers if c is not None), soup.body)
        if baseContainer is not None:
            for para in baseContainer.find_all("p"):
                cleaned = _cleanText(para.get_text())
                if cleaned and len(cleaned.split()) >= 8:
                    textContent.append(cleaned)
                if len(textContent) >= 25:
                    break

    # Last resort: metadata and title text to avoid hard failures in summary endpoint.
    if not textContent:
        metaCandidates = [
            soup.find("meta", attrs = {"name": "description"}),
            soup.find("meta", attrs = {"property": "og:description"}),
            soup.find("meta", attrs = {"name": "twitter:description"}),
        ]

        for metaTag in metaCandidates:
            if metaTag and metaTag.get("content"):
                cleaned = _cleanText(metaTag.get("content"))
                if cleaned:
                    textContent.append(cleaned)

        if not textContent and soup.title and soup.title.string:
            cleanedTitle = _cleanText(soup.title.string)
            if cleanedTitle:
                textContent.append(cleanedTitle)

    if textContent:
        return textContent

    return _scrapeViaReaderProxy(paperUrl)


def _cleanText(value: str) -> str:
    return " ".join(value.split()).strip()


def _extractPmcId(paperUrl: str) -> str:
    match = re.search(r"/pmc/articles/(PMC\d+)", paperUrl, flags = re.IGNORECASE)
    return match.group(1).upper() if match else ""


def _scrapePmcAbstract(paperUrl: str) -> list[str]:
    pmcId = _extractPmcId(paperUrl)
    if not pmcId:
        return []

    efetch = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
    params = {
        "db": "pmc",
        "id": pmcId,
        "retmode": "xml",
    }

    try:
        response = requests.get(efetch, params = params, timeout = 12)
        response.raise_for_status()
        root = ET.fromstring(response.text)
    except Exception:
        return []

    abstractNodes = root.findall(".//abstract//p")
    textContent = []

    for node in abstractNodes:
        text = _cleanText("".join(node.itertext()))
        if text:
            textContent.append(text)

    if textContent:
        return textContent

    # Some records use AbstractText or other variants.
    fallbackNodes = root.findall(".//AbstractText")
    for node in fallbackNodes:
        text = _cleanText("".join(node.itertext()))
        if text:
            textContent.append(text)

    return textContent


def _isBlockedText(text: str) -> bool:
    lowered = text.lower()
    signals = [
        "captcha",
        "forbidden",
        "access denied",
        "unauthorized",
        "robot",
        "bot detection",
        "cloudflare",
    ]
    return any(signal in lowered for signal in signals)


def _scrapeViaReaderProxy(paperUrl: str) -> list[str]:
    proxyUrl = f"https://r.jina.ai/http://{paperUrl.replace('https://', '').replace('http://', '')}"

    try:
        response = requests.get(proxyUrl, timeout = 18)
        response.raise_for_status()
    except Exception:
        return []

    text = _cleanText(response.text)
    if not text:
        return []

    # Keep only meaningful chunks.
    chunks = [chunk.strip() for chunk in response.text.split("\n\n") if chunk.strip()]
    cleanedChunks = []
    for chunk in chunks:
        cleaned = _cleanText(chunk)
        if len(cleaned.split()) >= 10:
            cleanedChunks.append(cleaned)
        if len(cleanedChunks) >= 30:
            break

    if cleanedChunks:
        if all(_isBlockedText(chunk) for chunk in cleanedChunks[:3]):
            return []
        return cleanedChunks

    if _isBlockedText(text):
        return []

    return [text[:4000]]


def fallbackSummaryFromTitle(title: str) -> str:
    cleanTitle = _cleanText(title)
    if not cleanTitle:
        return "No summary available for this paper."

    return "\n".join([
        f"- This publication appears to focus on: {cleanTitle}.",
        "- The source page could not be fully accessed for full-text summarization.",
        "- You can still open the paper link directly for details.",
        "- Use the search query terms to compare this paper against related results.",
        "- If access is restored, rerun AI Summary for a full content-based summary.",
    ])


# Search through the database for the most relevant papers given a query
# Using embeddings and cosine similarity
def findSearchMatch(query, paperDF, topMatches = 4) -> pd.DataFrame:
    workingDF = paperDF.copy()

    if not query:
        out = workingDF.head(topMatches).copy()
        out["Similarity"] = 0.0
        return out

    if hasOpenAIKey():
        queryEmbedding = np.asarray(makeQueryEmbeddingCached(query), dtype = np.float32)
        workingDF["Similarity"] = _vectorizedSimilarity(workingDF, queryEmbedding)
    else:
        queryTerms = set(query.lower().split())
        if not queryTerms:
            workingDF["Similarity"] = 0.0
        else:
            workingDF["Similarity"] = workingDF["Title"].apply(
                lambda t: _tokenOverlapScore(str(t), queryTerms)
            )

    workingDF.sort_values("Similarity", ascending = False, inplace = True)
    return workingDF.head(topMatches)


def _vectorizedSimilarity(paperDF: pd.DataFrame, queryEmbedding: np.ndarray) -> np.ndarray:
    vectors = paperDF.get("EmbeddingVector")
    if vectors is None:
        return np.zeros(len(paperDF), dtype = np.float32)

    vectorList = list(vectors)
    if not vectorList:
        return np.zeros(len(paperDF), dtype = np.float32)

    validMask = np.array([
        isinstance(v, np.ndarray) and v.size > 0 and v.shape[0] == queryEmbedding.shape[0]
        for v in vectorList
    ])

    similarities = np.zeros(len(vectorList), dtype = np.float32)
    if not validMask.any():
        return similarities

    matrix = np.vstack([vectorList[i] for i, valid in enumerate(validMask) if valid])
    queryNorm = np.linalg.norm(queryEmbedding)
    matrixNorms = np.linalg.norm(matrix, axis = 1)
    denom = np.maximum(matrixNorms * max(queryNorm, 1e-12), 1e-12)
    sims = (matrix @ queryEmbedding) / denom
    similarities[np.where(validMask)[0]] = sims

    return similarities


def _tokenOverlapScore(title: str, queryTerms: set[str]) -> float:
    titleTerms = set(title.lower().split())
    if not titleTerms:
        return 0.0
    return len(titleTerms.intersection(queryTerms)) / max(1, len(queryTerms))


def fallbackSummary(text: str) -> str:
    sentences = [s.strip() for s in text.replace("\n", " ").split(".") if s.strip()]
    if not sentences:
        return "No summary available for this paper."
    top = sentences[:5]
    bullets = [f"- {s}." for s in top]
    return "\n".join(bullets)


def _parseEmbedding(embeddingValue) -> np.ndarray:
    if isinstance(embeddingValue, list):
        return np.asarray(embeddingValue, dtype = np.float32)

    if isinstance(embeddingValue, str):
        stripped = embeddingValue.strip()
        if not stripped or stripped == "[]":
            return np.array([], dtype = np.float32)
        try:
            parsed = ast.literal_eval(stripped)
            return np.asarray(parsed, dtype = np.float32)
        except Exception:
            return np.array([], dtype = np.float32)

    return np.array([], dtype = np.float32)

# Function to set up the database with all the embeddings for the titles
def dataPreProcessing() -> pd.DataFrame:
    baseDir = Path(__file__).resolve().parent
    dataPath = baseDir / "SB_publication_PMC.csv"
    embeddingsPath = baseDir / "title_embeddings.csv"

    data = pd.read_csv(dataPath)

    # MIB: Extra code to drop any duplicates in data,
    # inplace param edits data pandas dataframe directly
    data.drop_duplicates(keep='first', inplace = True)

    # Load the file for word embeddings and add it to the dataframe
    try:
        with open(embeddingsPath, "r") as embeddingsFile:
            embeddingsData = pd.read_csv(embeddingsFile)
            data["Embedding"] = embeddingsData["Embedding"]

    
    # If file with embeddings for titles doesn't exist, create it
    except:
        if hasOpenAIKey():
            data["Embedding"] = data["Title"].apply(makeWordEmbeddings)
        else:
            # Keep a placeholder column so ranking can still run in lexical fallback mode.
            data["Embedding"] = "[]"

        with open(embeddingsPath, "w") as embeddingsFile:
            embeddingsFile.write(data.to_csv(index = False))

    data["id"] = data.index
    data["EmbeddingVector"] = data["Embedding"].apply(_parseEmbedding)

    return data
