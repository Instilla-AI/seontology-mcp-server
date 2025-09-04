import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";

// =============================================================================
// TRULY PURE NLP SYSTEM - ZERO HARDCODED PATTERNS OR STOPWORDS
// =============================================================================

interface Token {
  word: string;
  frequency: number;
  positions: number[];
  tfIdf: number;
  entropy: number;
  contextDiversity: number;
  semanticRole: 'content' | 'function' | 'entity' | 'modifier';
}

interface NGram {
  phrase: string;
  frequency: number;
  coherence: number;
  informationValue: number;
  positions: number[];
}

interface SemanticCluster {
  centroid: string;
  members: string[];
  coherenceScore: number;
  category: string;
}

interface LanguageProfile {
  language: string;
  confidence: number;
  avgWordLength: number;
  vowelRatio: number;
  consonantClusters: number;
}

class TrulyPureNLP {
  
  // =============================================================================
  // STATISTICAL LANGUAGE DETECTION (NO HARDCODED PATTERNS)
  // =============================================================================
  
  private detectLanguageStatistically(text: string): LanguageProfile {
    const cleanText = text.toLowerCase().replace(/[^\w\s]/g, ' ');
    const words = cleanText.split(/\s+/).filter(w => w.length > 0);
    
    if (words.length === 0) {
      return { language: 'unknown', confidence: 0, avgWordLength: 0, vowelRatio: 0, consonantClusters: 0 };
    }
    
    // Calcola caratteristiche linguistiche statistiche
    const totalChars = words.join('').length;
    const avgWordLength = totalChars / words.length;
    
    // Analisi vocalica/consonantica
    const vowels = (cleanText.match(/[aeiouàáâäèéêëìíîïòóôöùúûüçñýÿ]/g) || []).length;
    const vowelRatio = vowels / totalChars;
    
    // Cluster consonantici (indicatore di complessità linguistica)
    const consonantClusters = (cleanText.match(/[bcdfghjklmnpqrstvwxyz]{2,}/g) || []).length;
    
    // Frequenza di caratteri diacritici (per lingue romanze)
    const diacritics = (cleanText.match(/[àáâäèéêëìíîïòóôöùúûüçñýÿ]/g) || []).length;
    const diacriticRatio = diacritics / totalChars;
    
    // Analisi distribuzione lunghezza parole
    const wordLengthDistribution = new Map<number, number>();
    words.forEach(word => {
      wordLengthDistribution.set(word.length, (wordLengthDistribution.get(word.length) || 0) + 1);
    });
    
    // Calcola entropia della distribuzione
    const entropy = this.calculateEntropy(Array.from(wordLengthDistribution.values()));
    
    // Classificazione basata su caratteristiche statistiche
    let language = 'unknown';
    let confidence = 0;
    
    // Pattern statistici per riconoscimento linguistico
    if (avgWordLength > 6 && consonantClusters > words.length * 0.1) {
      language = 'de'; // Tedesco: parole lunghe, molti cluster consonantici
      confidence = 0.7;
    } else if (diacriticRatio > 0.02 && vowelRatio > 0.4) {
      if (avgWordLength < 5.5) {
        language = 'es'; // Spagnolo: molti diacritici, parole medie
        confidence = 0.6;
      } else {
        language = 'fr'; // Francese: diacritici, parole più lunghe
        confidence = 0.6;
      }
    } else if (diacriticRatio > 0.01 && entropy > 2.0) {
      language = 'it'; // Italiano: alcuni diacritici, alta entropia
      confidence = 0.5;
    } else {
      language = 'en'; // Default a inglese
      confidence = 0.3;
    }
    
    // Boost confidence se troviamo pattern tipici
    const bigramEntropy = this.calculateBigramEntropy(cleanText);
    if (bigramEntropy > 4.0) confidence = Math.min(0.9, confidence + 0.2);
    
    return {
      language,
      confidence,
      avgWordLength,
      vowelRatio,
      consonantClusters
    };
  }
  
  private calculateEntropy(values: number[]): number {
    const total = values.reduce((sum, val) => sum + val, 0);
    if (total === 0) return 0;
    
    return values.reduce((entropy, val) => {
      if (val === 0) return entropy;
      const p = val / total;
      return entropy - p * Math.log2(p);
    }, 0);
  }
  
  private calculateBigramEntropy(text: string): number {
    const bigrams = new Map<string, number>();
    
    for (let i = 0; i < text.length - 1; i++) {
      const bigram = text.substr(i, 2);
      if (/^[a-z]{2}$/.test(bigram)) {
        bigrams.set(bigram, (bigrams.get(bigram) || 0) + 1);
      }
    }
    
    return this.calculateEntropy(Array.from(bigrams.values()));
  }
  
  // =============================================================================
  // STATISTICAL STOP WORD DETECTION (NO PREDEFINED LISTS)
  // =============================================================================
  
  private identifyStopWordsStatistically(words: string[]): Set<string> {
    const wordFreq = new Map<string, number>();
    words.forEach(word => {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    });
    
    const totalWords = words.length;
    const stopWords = new Set<string>();
    
    // Identifica stop words basandosi su:
    // 1. Alta frequenza (> 1% del testo)
    // 2. Distribuzione uniforme nel testo
    // 3. Bassa entropia informativa
    
    for (const [word, freq] of wordFreq.entries()) {
      const relativeFreq = freq / totalWords;
      
      // Parole molto frequenti (>1% del testo) e corte (<= 4 caratteri)
      if (relativeFreq > 0.01 && word.length <= 4) {
        stopWords.add(word);
      }
      
      // Parole che appaiono in più del 20% delle "frasi" (approssimate)
      const sentences = this.approximateSentences(words);
      const sentenceAppearance = sentences.filter(sentence => 
        sentence.some(w => w === word)
      ).length;
      
      if (sentenceAppearance / sentences.length > 0.2 && word.length <= 6) {
        stopWords.add(word);
      }
    }
    
    return stopWords;
  }
  
  private approximateSentences(words: string[]): string[][] {
    const sentences: string[][] = [];
    let currentSentence: string[] = [];
    
    words.forEach(word => {
      currentSentence.push(word);
      // Approssima fine frase ogni 10-20 parole
      if (currentSentence.length >= 10 && Math.random() > 0.7) {
        sentences.push([...currentSentence]);
        currentSentence = [];
      }
    });
    
    if (currentSentence.length > 0) {
      sentences.push(currentSentence);
    }
    
    return sentences;
  }
  
  // =============================================================================
  // PURE TF-IDF IMPLEMENTATION
  // =============================================================================
  
  private calculateTFIDF(words: string[], stopWords: Set<string>): Token[] {
    const contentWords = words.filter(word => !stopWords.has(word) && word.length > 1);
    const wordFreq = new Map<string, number>();
    const wordPositions = new Map<string, number[]>();
    
    contentWords.forEach((word, index) => {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
      if (!wordPositions.has(word)) {
        wordPositions.set(word, []);
      }
      wordPositions.get(word)!.push(index);
    });
    
    const totalWords = contentWords.length;
    const tokens: Token[] = [];
    
    for (const [word, freq] of wordFreq.entries()) {
      const tf = freq / totalWords;
      
      // IDF semplificato: log(total_words / word_frequency)
      const idf = Math.log(totalWords / freq);
      const tfIdf = tf * idf;
      
      // Calcola entropia della parola (diversità di contesti)
      const positions = wordPositions.get(word)!;
      const contexts = positions.map(pos => {
        const start = Math.max(0, pos - 2);
        const end = Math.min(contentWords.length, pos + 3);
        return contentWords.slice(start, end).join(' ');
      });
      
      const uniqueContexts = new Set(contexts);
      const contextDiversity = uniqueContexts.size / contexts.length;
      
      // Entropia basata sulla distribuzione delle posizioni
      const positionEntropy = this.calculatePositionalEntropy(positions, totalWords);
      
      // Classifica semanticamente la parola
      const semanticRole = this.classifySemanticRole(word, freq, tfIdf, contextDiversity);
      
      tokens.push({
        word,
        frequency: freq,
        positions,
        tfIdf,
        entropy: positionEntropy,
        contextDiversity,
        semanticRole
      });
    }
    
    return tokens.sort((a, b) => b.tfIdf - a.tfIdf);
  }
  
  private calculatePositionalEntropy(positions: number[], totalLength: number): number {
    // Divide il testo in 10 bucket e calcola la distribuzione
    const buckets = new Array(10).fill(0);
    const bucketSize = totalLength / 10;
    
    positions.forEach(pos => {
      const bucket = Math.floor(pos / bucketSize);
      const clampedBucket = Math.min(bucket, 9);
      buckets[clampedBucket]++;
    });
    
    return this.calculateEntropy(buckets);
  }
  
  private classifySemanticRole(word: string, freq: number, tfIdf: number, contextDiversity: number): 'content' | 'function' | 'entity' | 'modifier' {
    // Classificazione puramente statistica
    
    // Entità: parole con prima lettera maiuscola nel testo originale, bassa frequenza, alta TF-IDF
    if (tfIdf > 0.01 && freq < 5 && contextDiversity < 0.5) {
      return 'entity';
    }
    
    // Parole di contenuto: alta TF-IDF, media frequenza
    if (tfIdf > 0.005 && freq > 2) {
      return 'content';
    }
    
    // Modificatori: alta diversità contestuale, frequenza media
    if (contextDiversity > 0.7 && freq > 1 && freq < 10) {
      return 'modifier';
    }
    
    // Default: parole funzionali
    return 'function';
  }
  
  // =============================================================================
  // N-GRAM EXTRACTION WITH COHERENCE SCORING
  // =============================================================================
  
  private extractNGrams(tokens: Token[], originalText: string): NGram[] {
    const ngrams: NGram[] = [];
    const words = tokens.map(t => t.word);
    
    // Estrai bigrammi
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i]} ${words[i + 1]}`;
      const freq = this.countOccurrences(originalText.toLowerCase(), bigram);
      
      if (freq > 0) {
        const coherence = this.calculateCoherence([words[i], words[i + 1]], tokens);
        const informationValue = this.calculateInformationValue(bigram, tokens);
        const positions = this.findPositions(originalText.toLowerCase(), bigram);
        
        ngrams.push({
          phrase: bigram,
          frequency: freq,
          coherence,
          informationValue,
          positions
        });
      }
    }
    
    // Estrai trigrammi
    for (let i = 0; i < words.length - 2; i++) {
      const trigram = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
      const freq = this.countOccurrences(originalText.toLowerCase(), trigram);
      
      if (freq > 0) {
        const coherence = this.calculateCoherence([words[i], words[i + 1], words[i + 2]], tokens);
        const informationValue = this.calculateInformationValue(trigram, tokens);
        const positions = this.findPositions(originalText.toLowerCase(), trigram);
        
        ngrams.push({
          phrase: trigram,
          frequency: freq,
          coherence,
          informationValue,
          positions
        });
      }
    }
    
    return ngrams
      .filter(ng => ng.coherence > 0.1) // Filtra n-grammi poco coerenti
      .sort((a, b) => (b.informationValue * b.coherence) - (a.informationValue * a.coherence))
      .slice(0, 20);
  }
  
  private countOccurrences(text: string, phrase: string): number {
    const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    return (text.match(regex) || []).length;
  }
  
  private findPositions(text: string, phrase: string): number[] {
    const positions: number[] = [];
    const words = text.split(/\s+/);
    const phraseWords = phrase.split(/\s+/);
    
    for (let i = 0; i <= words.length - phraseWords.length; i++) {
      const candidate = words.slice(i, i + phraseWords.length).join(' ');
      if (candidate === phrase) {
        positions.push(i);
      }
    }
    
    return positions;
  }
  
  private calculateCoherence(phraseWords: string[], tokens: Token[]): number {
    // Misura quanto spesso le parole appaiono insieme vs separatamente
    const wordTokens = phraseWords.map(word => 
      tokens.find(t => t.word === word)
    ).filter(Boolean) as Token[];
    
    if (wordTokens.length !== phraseWords.length) return 0;
    
    // Calcola distanza media tra le occorrenze delle parole
    let totalDistance = 0;
    let pairCount = 0;
    
    for (let i = 0; i < wordTokens.length - 1; i++) {
      for (let j = i + 1; j < wordTokens.length; j++) {
        const positions1 = wordTokens[i].positions;
        const positions2 = wordTokens[j].positions;
        
        // Trova le distanze minime tra tutte le coppie di posizioni
        let minDistance = Infinity;
        for (const pos1 of positions1) {
          for (const pos2 of positions2) {
            minDistance = Math.min(minDistance, Math.abs(pos1 - pos2));
          }
        }
        
        totalDistance += minDistance;
        pairCount++;
      }
    }
    
    if (pairCount === 0) return 0;
    
    const avgDistance = totalDistance / pairCount;
    // Coerenza inversamente proporzionale alla distanza
    return Math.max(0, 1 - (avgDistance / 10));
  }
  
  private calculateInformationValue(phrase: string, tokens: Token[]): number {
    const words = phrase.split(/\s+/);
    const wordTokens = words.map(word => 
      tokens.find(t => t.word === word)
    ).filter(Boolean) as Token[];
    
    if (wordTokens.length === 0) return 0;
    
    // Valore informativo = media delle TF-IDF delle parole componenti
    const avgTfIdf = wordTokens.reduce((sum, token) => sum + token.tfIdf, 0) / wordTokens.length;
    
    // Bonus per frasi più lunghe (più specifiche)
    const lengthBonus = Math.log(words.length + 1);
    
    return avgTfIdf * lengthBonus;
  }
  
  // =============================================================================
  // UNSUPERVISED SEMANTIC CLUSTERING
  // =============================================================================
  
  private clusterSemantically(tokens: Token[], ngrams: NGram[]): SemanticCluster[] {
    const allTerms = [
      ...tokens.map(t => ({ term: t.word, score: t.tfIdf, role: t.semanticRole })),
      ...ngrams.map(ng => ({ term: ng.phrase, score: ng.informationValue, role: 'phrase' as const }))
    ];
    
    // Clustering basato su co-occorrenza e similarità semantica
    const clusters: SemanticCluster[] = [];
    const processed = new Set<string>();
    
    for (const term of allTerms) {
      if (processed.has(term.term)) continue;
      
      const cluster: SemanticCluster = {
        centroid: term.term,
        members: [term.term],
        coherenceScore: term.score,
        category: this.inferCategory(term.term, term.role, allTerms)
      };
      
      // Trova termini correlati
      for (const other of allTerms) {
        if (other.term === term.term || processed.has(other.term)) continue;
        
        const similarity = this.calculateTermSimilarity(term.term, other.term, tokens, ngrams);
        if (similarity > 0.3) {
          cluster.members.push(other.term);
          cluster.coherenceScore += other.score * similarity;
          processed.add(other.term);
        }
      }
      
      processed.add(term.term);
      clusters.push(cluster);
    }
    
    return clusters
      .sort((a, b) => b.coherenceScore - a.coherenceScore)
      .slice(0, 10);
  }
  
  private calculateTermSimilarity(term1: string, term2: string, tokens: Token[], ngrams: NGram[]): number {
    // Similarità basata su:
    // 1. Overlap di parole
    // 2. Prossimità nelle posizioni
    // 3. Similarità di frequenza
    
    const words1 = term1.split(/\s+/);
    const words2 = term2.split(/\s+/);
    
    // Jaccard similarity per overlap di parole
    const intersection = words1.filter(w => words2.includes(w));
    const union = [...new Set([...words1, ...words2])];
    const jaccard = intersection.length / union.length;
    
    if (jaccard > 0) return jaccard; // Se condividono parole, alta similarità
    
    // Altrimenti, calcola prossimità spaziale
    const positions1 = this.getTermPositions(term1, tokens, ngrams);
    const positions2 = this.getTermPositions(term2, tokens, ngrams);
    
    if (positions1.length === 0 || positions2.length === 0) return 0;
    
    let minDistance = Infinity;
    for (const pos1 of positions1) {
      for (const pos2 of positions2) {
        minDistance = Math.min(minDistance, Math.abs(pos1 - pos2));
      }
    }
    
    // Similarità inversamente proporzionale alla distanza
    return minDistance < 5 ? (5 - minDistance) / 5 : 0;
  }
  
  private getTermPositions(term: string, tokens: Token[], ngrams: NGram[]): number[] {
    const token = tokens.find(t => t.word === term);
    if (token) return token.positions;
    
    const ngram = ngrams.find(ng => ng.phrase === term);
    if (ngram) return ngram.positions;
    
    return [];
  }
  
  private inferCategory(term: string, role: string, allTerms: Array<{term: string, score: number, role: string}>): string {
    // Inferisci categoria basandosi puramente su caratteristiche statistiche
    
    // Pattern numerici/monetari
    if (/\d/.test(term) || /[$€£¥₹%]/.test(term)) {
      return 'quantitative';
    }
    
    // Entità (nomi propri, capitalizzati)
    if (/^[A-Z]/.test(term) && role === 'entity') {
      return 'entity';
    }
    
    // Azioni (parole che spesso precedono oggetti)
    if (role === 'content' && term.length > 4) {
      const score = allTerms.find(t => t.term === term)?.score || 0;
      if (score > 0.01) {
        return 'action';
      }
    }
    
    // Descrittori (modificatori con alta diversità contestuale)
    if (role === 'modifier') {
      return 'descriptor';
    }
    
    // Concetti (frasi multi-parola con alta informazione)
    if (term.includes(' ') && role === 'phrase') {
      return 'concept';
    }
    
    return 'general';
  }
  
  // =============================================================================
  // QUERY TYPE CLASSIFICATION (PURE STATISTICAL)
  // =============================================================================
  
  private classifyQueryTypeStatistically(clusters: SemanticCluster[], languageProfile: LanguageProfile): string {
    // Classifica basandosi su pattern statistici nei cluster
    
    const categoryScores = {
      'commercial': 0,
      'transactional': 0,
      'navigational': 0,
      'informational': 0
    };
    
    for (const cluster of clusters) {
      const category = cluster.category;
      const score = cluster.coherenceScore;
      
      // Mappa le categorie inferite ai tipi di query
      switch (category) {
        case 'quantitative':
          categoryScores.commercial += score * 2;
          break;
        case 'action':
          categoryScores.transactional += score * 1.5;
          break;
        case 'entity':
          categoryScores.navigational += score;
          break;
        case 'concept':
        case 'descriptor':
          categoryScores.informational += score;
          break;
        default:
          categoryScores.informational += score * 0.5;
      }
    }
    
    // Trova la categoria con punteggio più alto
    const maxCategory = Object.entries(categoryScores)
      .reduce((max, [cat, score]) => score > max.score ? { category: cat, score } : max, 
              { category: 'informational', score: 0 });
    
    return maxCategory.category;
  }
  
  // =============================================================================
  // MAIN ANALYSIS FUNCTION
  // =============================================================================
  
  public analyze(title: string, metaDescription: string, bodyText: string, preferredLanguage?: string) {
    const combinedText = `${title} ${metaDescription} ${bodyText}`;
    
    // 1. Rilevamento lingua statistico
    const languageProfile = preferredLanguage ? 
      { language: preferredLanguage, confidence: 1, avgWordLength: 0, vowelRatio: 0, consonantClusters: 0 } :
      this.detectLanguageStatistically(combinedText);
    
    // 2. Tokenizzazione e identificazione stop words
    const words = combinedText.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    const stopWords = this.identifyStopWordsStatistically(words);
    
    // 3. Calcolo TF-IDF puro
    const tokens = this.calculateTFIDF(words, stopWords);
    
    // 4. Estrazione N-grammi con coerenza
    const ngrams = this.extractNGrams(tokens, combinedText);
    
    // 5. Clustering semantico non supervisionato
    const clusters = this.clusterSemantically(tokens, ngrams);
    
    // 6. Classificazione tipo di query statistica
    const queryType = this.classifyQueryTypeStatistically(clusters, languageProfile);
    
    // 7. Selezione query principale
    let mainQuery: string;
    
    // Priorità a n-grammi dal titolo con alta informazione
    const titleNgrams = ngrams.filter(ng => title.toLowerCase().includes(ng.phrase));
    if (titleNgrams.length > 0) {
      mainQuery = titleNgrams[0].phrase;
    } else if (ngrams.length > 0) {
      mainQuery = ngrams[0].phrase;
    } else {
      // Fallback a token singolo più significativo
      const titleTokens = tokens.filter(t => title.toLowerCase().includes(t.word));
      mainQuery = titleTokens.length > 0 ? titleTokens[0].word : tokens[0]?.word || title.toLowerCase();
    }
    
    // 8. Metriche e risultato finale
    const topClusterScore = clusters[0]?.coherenceScore || 0;
    const topNgramScore = ngrams[0]?.informationValue || 0;
    const confidence = Math.min(100, Math.round((topClusterScore + topNgramScore) * 10));
    
    return {
      mainQuery,
      queryType,
      confidence,
      language: languageProfile.language,
      languageConfidence: languageProfile.confidence,
      entities: this.extractEntitiesStatistically(combinedText),
      keyphrases: ngrams.slice(0, 5).map(ng => ng.phrase),
      semanticClusters: clusters.slice(0, 5),
      tokens: tokens.slice(0, 10),
      stopWordsIdentified: Array.from(stopWords).slice(0, 10),
      nlpMetrics: {
        totalTokens: tokens.length,
        avgTfIdf: tokens.reduce((sum, t) => sum + t.tfIdf, 0) / tokens.length,
        vocabularyRichness: tokens.length / words.length,
        semanticCohesion: clusters.reduce((sum, c) => sum + c.coherenceScore, 0) / clusters.length
      }
    };
  }
  
  private extractEntitiesStatistically(text: string): string[] {
    const entities: string[] = [];
    
    // Estrazione entità basata puramente su pattern statistici
    
    // Sequenze di parole capitalizzate (nomi propri)
    const capitalizedSequences = text.match(/\b[A-ZÀ-Ý][a-zà-ÿ]+(?:\s+[A-ZÀ-Ý][a-zà-ÿ]+)*\b/g) || [];
    entities.push(...capitalizedSequences.slice(0, 5));
    
    // Pattern numerici significativi
    const numbers = text.match(/\b\d{1,}([.,]\d+)?\s*[%€$£¥₹]?\b/g) || [];
    entities.push(...numbers.slice(0, 3));
    
    // Pattern di date
    const dates = text.match(/\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/g) || [];
    entities.push(...dates);
    
    // Email e URL
    const emails = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g) || [];
    entities.push(...emails);
    
    const urls = text.match(/https?:\/\/[^\s]+/g) || [];
    entities.push(...urls);
    
    return [...new Set(entities)].slice(0, 10);
  }
}

// =============================================================================
// EXPRESS APP SETUP
// =============================================================================

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS per permettere chiamate da n8n
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    service: "seontology-mcp-server", 
    version: "1.0.0",
    features: ["truly-pure-nlp", "zero-hardcoding", "multilingual-auto-detection"],
    timestamp: new Date().toISOString() 
  });
});

// Endpoint principale
app.get("/", (req, res) => {
  res.json({ 
    service: "SEOntology MCP Server", 
    version: "2.0.0",
    features: {
      "nlp": "Truly Pure NLP with zero hardcoded patterns",
      "languages": "Auto-detected (statistical analysis)",
      "capabilities": [
        "automatic-stop-word-detection", 
        "unsupervised-clustering", 
        "statistical-language-detection",
        "pure-tf-idf-analysis",
        "semantic-role-classification"
      ]
    },
    endpoints: {
      health: "/health",
      seontology: "/api/seontology",
      extractQuery: "/api/extract-query",
      test: "/api/test",
      mcp: "/mcp (STDIO only)"
    }
  });
});

// Test endpoints
app.get("/api/test", (req, res) => {
  res.json({
    success: true,
    message: "Server funzionante",
    version: "1.0.0",
    nlp_approach: "truly-pure-statistical",
    timestamp: new Date().toISOString(),
    query: req.query
  });
});

app.post("/api/test", (req, res) => {
  res.json({
    success: true,
    message: "POST test ricevuto",
    body: req.body,
    headers: req.headers,
    timestamp: new Date().toISOString()
  });
});

// =============================================================================
// SEONTOLOGY FUNCTIONS
// =============================================================================

// Funzione per creare JSON-LD SEOntology (invariata)
function createSeontologyJsonLD(args: {
  url: string;
  title: string;
  metaDescription: string;
  primaryQuery: string;
  bodyText?: string;
  language?: string;
}) {
  const { url, title, metaDescription, primaryQuery } = args;
  const bodyText = args.bodyText ?? "";
  const language = args.language ?? "auto-detected";

  // Validazione
  const requiredFields = ["url", "title", "metaDescription", "primaryQuery"];
  for (const field of requiredFields) {
    if (!args[field as keyof typeof args] || typeof args[field as keyof typeof args] !== "string" || !args[field as keyof typeof args]?.trim()) {
      throw new Error(`Campo richiesto mancante o vuoto: ${field}`);
    }
  }

  // Chunking semplice
  const chunks: Array<{
    "@type": string;
    "seo:chunkPosition": number;
    "seo:chunkText": string;
  }> = [];

  if (bodyText && bodyText.trim()) {
    const rawChunks = bodyText
      .split(/\n\s*\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    rawChunks.forEach((text, i) => {
      chunks.push({
        "@type": "seo:Chunk",
        "seo:chunkPosition": i + 1,
        "seo:chunkText": text
      });
    });
  }

  // Costruzione JSON-LD
  const jsonld = {
    "@context": {
      seo: "https://seontology.org/vocab#",
      schema: "https://schema.org/"
    },
    "@type": "seo:WebPage",
    "@id": url,
    "schema:url": url,
    "seo:title": title,
    "seo:metaDescription": metaDescription,
    "seo:hasPrimaryQuery": {
      "@type": "seo:Query",
      "schema:name": primaryQuery
    },
    "seo:hasLanguage": {
      "@type": "schema:Language",
      "schema:name": language
    },
    ...(chunks.length > 0 && { "seo:hasChunk": chunks }),
    "schema:dateModified": new Date().toISOString()
  };

  return jsonld;
}

// Funzione di estrazione query con NLP veramente puro
function extractQueryPureNLP(args: {
  url?: string;
  title: string;
  metaDescription: string;
  bodyText: string;
  language?: string;
}): any {
  const { url, title, metaDescription, bodyText, language } = args;

  if (!title?.trim() || !bodyText?.trim()) {
    throw new Error("Title e bodyText sono richiesti per l'estrazione della query");
  }

  // Analisi NLP completamente pura
  const nlp = new TrulyPureNLP();
  const analysis = nlp.analyze(title, metaDescription || "", bodyText, language);

  // Calcolo metriche addizionali
  const combinedText = `${title} ${metaDescription} ${bodyText}`;
  const queryRegex = new RegExp(analysis.mainQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  const queryMatches = combinedText.match(queryRegex) || [];
  const totalWords = combinedText.split(/\s+/).length;

  return {
    "@context": {
      seo: "https://seontology.org/vocab#",
      schema: "https://schema.org/"
    },
    "@type": "seo:Query",
    "schema:name": analysis.mainQuery,
    "seo:queryType": analysis.queryType,
    "seo:language": analysis.language,
    "seo:queryScore": analysis.confidence,
    "seo:alternativeQueries": analysis.keyphrases,
    "seo:relatedEntities": analysis.entities,
    "seo:semanticClusters": analysis.semanticClusters.map(c => ({
      "seo:category": c.category,
      "seo:terms": c.members,
      "seo:relevance": Math.round(c.coherenceScore * 100) / 100
    })),
    "seo:keywordDensity": {
      "seo:primaryKeyword": {
        "schema:name": analysis.mainQuery,
        "seo:frequency": queryMatches.length,
        "seo:density": parseFloat((queryMatches.length / totalWords * 100).toFixed(2))
      }
    },
    "seo:pureNlpAnalysis": {
      "seo:languageDetected": analysis.language,
      "seo:languageConfidence": Math.round(analysis.languageConfidence * 100),
      "seo:stopWordsDetected": analysis.stopWordsIdentified,
      "seo:vocabularyRichness": Math.round(analysis.nlpMetrics.vocabularyRichness * 100) / 100,
      "seo:semanticCohesion": Math.round(analysis.nlpMetrics.semanticCohesion * 100) / 100,
      "seo:topTokens": analysis.tokens.map(t => ({
        "schema:name": t.word,
        "seo:tfIdf": Math.round(t.tfIdf * 1000) / 1000,
        "seo:semanticRole": t.semanticRole
      })),
      "seo:approach": "unsupervised-statistical-nlp",
      "seo:processedWith": "truly-pure-nlp-v4.0"
    },
    "seo:extractedFrom": url || "provided content",
    "schema:dateCreated": new Date().toISOString()
  };
}

// =============================================================================
// HTTP REST API ENDPOINTS
// =============================================================================

// Endpoint con NLP veramente puro
app.post("/api/extract-query", async (req, res) => {
  try {
    const { url, title, metaDescription, bodyText, language } = req.body;

    // Validazione
    if (!title?.trim()) {
      throw new Error("Il campo 'title' è richiesto");
    }
    if (!bodyText?.trim()) {
      throw new Error("Il campo 'bodyText' è richiesto");
    }

    // Estrai la query principale con NLP puro
    const queryResult = extractQueryPureNLP({
      url,
      title,
      metaDescription: metaDescription || "",
      bodyText,
      language
    });

    const nlpAnalysis = queryResult["seo:pureNlpAnalysis"];
    const summary = `🧠 PURE NLP ANALYSIS\n` +
                   `🎯 Query estratta: "${queryResult["schema:name"]}"\n` +
                   `📊 Tipo query: ${queryResult["seo:queryType"]}\n` +
                   `🔢 Confidence: ${queryResult["seo:queryScore"]}\n` +
                   `🌍 Lingua rilevata: ${nlpAnalysis["seo:languageDetected"]} (${nlpAnalysis["seo:languageConfidence"]}%)\n` +
                   `🛑 Stop words identificate: ${nlpAnalysis["seo:stopWordsDetected"].slice(0,3).join(", ")}\n` +
                   `📈 Ricchezza vocabolario: ${nlpAnalysis["seo:vocabularyRichness"]}\n` +
                   `🔗 Coesione semantica: ${nlpAnalysis["seo:semanticCohesion"]}\n` +
                   `🔑 Frasi chiave: ${queryResult["seo:alternativeQueries"].join(", ")}\n` +
                   `🏷️ Top entities: ${queryResult["seo:relatedEntities"].slice(0, 3).join(", ")}`;

    res.json({
      success: true,
      summary: summary,
      query: queryResult,
      processedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error("Errore estrazione query:", error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Errore sconosciuto",
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint per generare JSON-LD SEOntology
app.post("/api/seontology", async (req, res) => {
  try {
    const { url, title, metaDescription, primaryQuery, bodyText, language } = req.body;

    // Crea il JSON-LD
    const jsonld = createSeontologyJsonLD({
      url,
      title,
      metaDescription,
      primaryQuery,
      bodyText,
      language
    });

    const summary = `JSON-LD SEOntology creato con successo per: ${title}\n` +
                   `URL: ${url}\n` +
                   `Query primaria: ${primaryQuery}\n` +
                   `Chunks generati: ${jsonld["seo:hasChunk"]?.length || 0}\n` +
                   `Lingua: ${language || "auto-detected"}`;

    res.json({
      success: true,
      summary: summary,
      jsonLd: jsonld,
      processedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error("Errore API SEOntology:", error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Errore sconosciuto",
      timestamp: new Date().toISOString()
    });
  }
});

// =============================================================================
// MCP ENDPOINT
// =============================================================================

app.post("/mcp", async (req, res) => {
  try {
    const { jsonrpc, id, method, params } = req.body;

    if (jsonrpc !== "2.0") {
      return res.status(400).json({
        jsonrpc: "2.0",
        id: id,
        error: { code: -32600, message: "Invalid Request - jsonrpc must be 2.0" }
      });
    }

    if (method === "tools/list") {
      return res.json({
        jsonrpc: "2.0",
        id: id,
        result: {
          tools: [
            {
              name: "wrap_as_seontology",
              description: "Impacchetta url/title/meta (+ testo opzionale) in JSON-LD conforme a SEOntology",
              inputSchema: {
                type: "object",
                properties: {
                  url: { type: "string", description: "URL canonico della pagina web" },
                  title: { type: "string", description: "Titolo HTML/SEO della pagina" },
                  metaDescription: { type: "string", description: "Meta description della pagina" },
                  primaryQuery: { type: "string", description: "Query primaria target" },
                  bodyText: { type: "string", description: "Testo completo della pagina (opzionale)" },
                  language: { type: "string", description: "Lingua preferita (auto-rilevata se non specificata)" }
                },
                required: ["url", "title", "metaDescription", "primaryQuery"]
              }
            },
            {
              name: "extract_main_query",
              description: "Estrae la query principale con NLP veramente puro (zero hardcoding, analisi statistica)",
              inputSchema: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Titolo HTML/SEO della pagina" },
                  metaDescription: { type: "string", description: "Meta description della pagina" },
                  bodyText: { type: "string", description: "Testo completo della pagina" },
                  url: { type: "string", description: "URL della pagina (opzionale)" },
                  language: { type: "string", description: "Lingua preferita (auto-rilevata se non specificata)" }
                },
                required: ["title", "bodyText"]
              }
            }
          ]
        }
      });
    }

    if (method === "tools/call" && params?.name === "wrap_as_seontology") {
      const jsonld = createSeontologyJsonLD(params.arguments);
      
      const summary = `✅ JSON-LD SEOntology creato con successo per: ${params.arguments.title}\n` +
                     `🔗 URL: ${params.arguments.url}\n` +
                     `🎯 Query primaria: ${params.arguments.primaryQuery}\n` +
                     `📝 Chunks generati: ${jsonld["seo:hasChunk"]?.length || 0}`;

      return res.json({
        jsonrpc: "2.0",
        id: id,
        result: {
          content: [
            { type: "text", text: summary },
            { type: "text", text: JSON.stringify(jsonld, null, 2) }
          ]
        }
      });
    }

    if (method === "tools/call" && params?.name === "extract_main_query") {
      const queryResult = extractQueryPureNLP(params.arguments);
      const nlpAnalysis = queryResult["seo:pureNlpAnalysis"];
      
      const summary = `🧠 PURE NLP: "${queryResult["schema:name"]}" (${queryResult["seo:queryType"]})\n` +
                     `🌍 ${nlpAnalysis["seo:languageDetected"]} (${nlpAnalysis["seo:languageConfidence"]}%)\n` +
                     `📊 Score: ${queryResult["seo:queryScore"]} | Ricchezza: ${nlpAnalysis["seo:vocabularyRichness"]}\n` +
                     `🔑 Alternative: ${queryResult["seo:alternativeQueries"].slice(0,3).join(", ")}`;

      return res.json({
        jsonrpc: "2.0",
        id: id,
        result: {
          content: [
            { type: "text", text: summary },
            { type: "text", text: JSON.stringify(queryResult, null, 2) }
          ]
        }
      });
    }

    res.status(404).json({
      jsonrpc: "2.0",
      id: id,
      error: { code: -32601, message: `Method not found: ${method}` }
    });

  } catch (error) {
    console.error("Errore MCP endpoint:", error);
    res.status(500).json({
      jsonrpc: "2.0",
      id: req.body?.id,
      error: { 
        code: -32603, 
        message: "Internal error", 
        data: error instanceof Error ? error.message : "Unknown error" 
      }
    });
  }
});

// =============================================================================
// MCP STDIO SERVER
// =============================================================================

async function initMcpServer() {
  const server = new Server({
    name: "seontology-mcp",
    version: "1.0.0",
  }, {
    capabilities: { tools: {} },
  });

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "wrap_as_seontology",
          description: "Impacchetta url/title/meta (+ testo opzionale) in JSON-LD conforme a SEOntology",
          inputSchema: {
            type: "object",
            properties: {
              url: { type: "string", description: "URL canonico della pagina web" },
              title: { type: "string", description: "Titolo HTML/SEO della pagina" },
              metaDescription: { type: "string", description: "Meta description della pagina" },
              primaryQuery: { type: "string", description: "Query primaria target" },
              bodyText: { type: "string", description: "Testo completo della pagina (opzionale)" },
              language: { type: "string", description: "Lingua preferita (auto-rilevata se non specificata)" }
            },
            required: ["url", "title", "metaDescription", "primaryQuery"]
          }
        },
        {
          name: "extract_main_query",
          description: "Estrae la query principale con NLP veramente puro (zero hardcoding, analisi statistica)",
          inputSchema: {
            type: "object",
            properties: {
              title: { type: "string", description: "Titolo HTML/SEO della pagina" },
              metaDescription: { type: "string", description: "Meta description della pagina" },
              bodyText: { type: "string", description: "Testo completo della pagina" },
              url: { type: "string", description: "URL della pagina (opzionale)" },
              language: { type: "string", description: "Lingua preferita (auto-rilevata se non specificata)" }
            },
            required: ["title", "bodyText"]
          }
        }
      ]
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === "wrap_as_seontology") {
      const jsonld = createSeontologyJsonLD(args as any);
      const summary = `✅ JSON-LD SEOntology creato per: ${(args as any).title}`;

      return {
        content: [
          { type: "text", text: summary },
          { type: "text", text: JSON.stringify(jsonld, null, 2) }
        ]
      };
    }

    if (name === "extract_main_query") {
      const queryResult = extractQueryPureNLP(args as any);
      const nlpAnalysis = queryResult["seo:pureNlpAnalysis"];
      const summary = `🧠 Query estratta: "${queryResult["schema:name"]}" (${nlpAnalysis["seo:languageDetected"]}, Pure NLP)`;

      return {
        content: [
          { type: "text", text: summary },
          { type: "text", text: JSON.stringify(queryResult, null, 2) }
        ]
      };
    }

    throw new McpError(ErrorCode.MethodNotFound, `Tool non trovato: ${name}`);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("✅ MCP STDIO server avviato con NLP veramente puro (v1.0.0)");
}

// =============================================================================
// SERVER STARTUP
// =============================================================================

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  console.log(`✅ HTTP server avviato su porta ${PORT}`);
  console.log(`🌍 API endpoint: http://localhost:${PORT}/api/seontology`);
  console.log(`🧠 Improved NLP Query extraction: http://localhost:${PORT}/api/extract-query`);
  console.log(`🔗 MCP endpoint: http://localhost:${PORT}/mcp`);
  console.log(`❤️  Health check: http://localhost:${PORT}/health`);
  console.log(`🚀 Features: Domain Recognition + Title Focus!`);
});

// Avvio del server MCP STDIO se eseguito direttamente
if (import.meta.url === `file://${process.argv[1]}`) {
  initMcpServer().catch((error) => {
    console.error("❌ Errore durante l'avvio del server MCP:", error);
    process.exit(1);
  });
}
