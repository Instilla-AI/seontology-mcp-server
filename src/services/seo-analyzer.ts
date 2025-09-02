import axios from 'axios';
import * as cheerio from 'cheerio';
import natural from 'natural';
import compromise from 'compromise';

export interface SEOAnalysisOptions {
  includeImages?: boolean;
  extractEntities?: boolean;
  qualityScore?: boolean;
  deepAnalysis?: boolean;
}

export interface KeywordOptions {
  maxKeywords: number;
  minFrequency: number;
}

export interface LinkAnalysisOptions {
  depth: number;
  checkBroken: boolean;
}

export class SEOAnalyzer {
  private tokenizer = new natural.WordTokenizer();
  private stemmer = natural.PorterStemmer;

  async analyzePage(content: any, options: SEOAnalysisOptions) {
    const analysis = {
      basic: await this.basicAnalysis(content),
      keywords: await this.extractPageKeywords(content),
      images: options.includeImages ? await this.analyzeImages(content) : null,
      entities: options.extractEntities ? await this.extractEntities(content) : null,
      quality: options.qualityScore ? await this.calculateQualityScore(content) : null,
      technical: await this.technicalAnalysis(content),
    };

    if (options.deepAnalysis) {
      analysis['deepAnalysis'] = await this.performDeepAnalysis(content);
    }

    return analysis;
  }

  private async basicAnalysis(content: any) {
    return {
      title: content.title || '',
      metaDescription: content.metaDescription || '',
      headings: content.headings || [],
      wordCount: content.wordCount || 0,
      readingTime: Math.ceil((content.wordCount || 0) / 200),
      language: await this.detectLanguage(content.text || ''),
    };
  }

  private async extractPageKeywords(content: any) {
    const text = content.text || '';
    const tokens = this.tokenizer.tokenize(text.toLowerCase());
    
    // Remove stop words and short words
    const stopWords = natural.stopwords;
    const filtered = tokens?.filter(token => 
      token.length > 2 && !stopWords.includes(token)
    ) || [];

    // Calculate frequency
    const freq = natural.FreqDist.calculate(filtered);
    
    // Get top keywords
    const keywords = Object.entries(freq)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 20)
      .map(([word, frequency]) => ({
        word,
        frequency,
        stem: this.stemmer.stem(word),
      }));

    return keywords;
  }

  async extractKeywords(content: any, options: KeywordOptions) {
    const keywords = await this.extractPageKeywords(content);
    
    return keywords
      .filter(k => k.frequency >= options.minFrequency)
      .slice(0, options.maxKeywords)
      .map(keyword => ({
        text: keyword.word,
        frequency: keyword.frequency,
        type: this.classifyKeywordIntent(keyword.word),
        variations: this.getKeywordVariations(keyword.word),
      }));
  }

  private classifyKeywordIntent(keyword: string): string {
    const doc = compromise(keyword);
    
    // Simple intent classification
    if (doc.match('#Question').found) return 'INFORMATIONAL';
    if (doc.match('buy|purchase|price|cost').found) return 'TRANSACTIONAL';
    if (doc.match('best|vs|compare|review').found) return 'COMMERCIAL';
    if (doc.match('how|what|why|when|where').found) return 'INFORMATIONAL';
    
    return 'NAVIGATIONAL';
  }

  private getKeywordVariations(keyword: string): string[] {
    const doc = compromise(keyword);
    const variations = [];
    
    // Plural/singular
    if (doc.nouns().found) {
      variations.push(doc.nouns().toPlural().text());
      variations.push(doc.nouns().toSingular().text());
    }
    
    // Stemmed version
    variations.push(this.stemmer.stem(keyword));
    
    return [...new Set(variations)].filter(v => v !== keyword);
  }

  async generateSchema(content: any, schemaType: string) {
    const baseSchema = {
      '@context': 'https://schema.org',
      '@type': schemaType,
      url: content.url,
    };

    switch (schemaType) {
      case 'Article':
        return {
          ...baseSchema,
          headline: content.title,
          description: content.metaDescription,
          wordCount: content.wordCount,
          datePublished: content.datePublished || new Date().toISOString(),
          author: {
            '@type': 'Organization',
            name: content.siteName || 'Unknown',
          },
        };
      
      case 'WebPage':
        return {
          ...baseSchema,
          name: content.title,
          description: content.metaDescription,
          mainContentOfPage: content.text?.substring(0, 500),
        };
      
      default:
        return baseSchema;
    }
  }

  async analyzeInternalLinks(url: string, options: LinkAnalysisOptions) {
    try {
      const response = await axios.get(url, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SEOntology-MCP/1.0)',
        },
      });
      const $ = cheerio.load(response.data);
      
      const links = [];
      const brokenLinks = [];
      const externalLinks = [];

      $('a[href]').each((i, element) => {
        const href = $(element).attr('href');
        const text = $(element).text().trim();
        
        if (!href) return;

        const linkData = {
          url: href,
          anchorText: text,
          isInternal: this.isInternalLink(href, url),
          isExternal: this.isExternalLink(href, url),
        };

        if (linkData.isInternal) {
          links.push(linkData);
        } else if (linkData.isExternal) {
          externalLinks.push(linkData);
        }
      });

      // Check for broken links if requested
      if (options.checkBroken) {
        for (const link of links.slice(0, 50)) { // Limit to first 50 for performance
          try {
            await axios.head(link.url, { timeout: 5000 });
          } catch (error) {
            brokenLinks.push({
              ...link,
              error: error.message,
            });
          }
        }
      }

      return {
        internalLinks: links,
        externalLinks,
        brokenLinks,
        stats: {
          totalInternal: links.length,
          totalExternal: externalLinks.length,
          totalBroken: brokenLinks.length,
        },
      };
    } catch (error) {
      throw new Error(`Link analysis failed: ${error.message}`);
    }
  }

  private isInternalLink(href: string, baseUrl: string): boolean {
    if (href.startsWith('/')) return true;
    if (href.startsWith('#')) return false;
    
    try {
      const base = new URL(baseUrl);
      const link = new URL(href);
      return base.hostname === link.hostname;
    } catch {
      return false;
    }
  }

  private isExternalLink(href: string, baseUrl: string): boolean {
    if (href.startsWith('/') || href.startsWith('#')) return false;
    
    try {
      const base = new URL(baseUrl);
      const link = new URL(href);
      return base.hostname !== link.hostname;
    } catch {
      return false;
    }
  }

  async analyzeContentGaps(primaryUrl: string, competitorUrls: string[], topic?: string) {
    const results = {
      primaryContent: null as any,
      competitorContents: [] as any[],
      gaps: {
        keywords: [] as string[],
        entities: [] as string[],
        topics: [] as string[],
      },
      opportunities: [] as any[],
    };

    // Analyze primary content
    try {
      const primaryContent = await this.extractContentForGapAnalysis(primaryUrl);
      results.primaryContent = primaryContent;

      // Analyze competitors
      for (const competitorUrl of competitorUrls.slice(0, 5)) { // Limit to 5 competitors
        try {
          const competitorContent = await this.extractContentForGapAnalysis(competitorUrl);
          results.competitorContents.push(competitorContent);
        } catch (error) {
          console.warn(`Failed to analyze competitor ${competitorUrl}: ${error.message}`);
        }
      }

      // Find gaps
      results.gaps = await this.identifyContentGaps(
        results.primaryContent,
        results.competitorContents
      );

      // Generate opportunities
      results.opportunities = await this.generateContentOpportunities(results.gaps, topic);

    } catch (error) {
      throw new Error(`Content gap analysis failed: ${error.message}`);
    }

    return results;
  }

  private async extractContentForGapAnalysis(url: string) {
    const response = await axios.get(url, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SEOntology-MCP/1.0)',
      },
    });
    const $ = cheerio.load(response.data);
    
    const content = {
      url,
      title: $('title').text(),
      headings: [] as string[],
      text: $('body').text(),
      keywords: [] as any[],
      entities: [] as any[],
    };

    // Extract headings
    $('h1, h2, h3, h4, h5, h6').each((i, element) => {
      content.headings.push($(element).text().trim());
    });

    // Extract keywords
    content.keywords = await this.extractPageKeywords(content);

    // Extract entities (simplified)
    content.entities = await this.extractEntities(content);

    return content;
  }

  private async identifyContentGaps(primary: any, competitors: any[]) {
    const gaps = {
      keywords: [] as string[],
      entities: [] as string[],
      topics: [] as string[],
    };

    // Collect all competitor keywords
    const competitorKeywords = new Set<string>();
    const competitorEntities = new Set<string>();
    const competitorTopics = new Set<string>();

    competitors.forEach(competitor => {
      competitor.keywords.forEach((kw: any) => competitorKeywords.add(kw.word));
      competitor.entities.forEach((entity: any) => competitorEntities.add(entity.name));
      competitor.headings.forEach((heading: string) => competitorTopics.add(heading));
    });

    // Find gaps
    const primaryKeywords = new Set(primary.keywords.map((kw: any) => kw.word));
    const primaryEntities = new Set(primary.entities.map((entity: any) => entity.name));
    const primaryTopics = new Set(primary.headings);

    gaps.keywords = [...competitorKeywords].filter(kw => !primaryKeywords.has(kw));
    gaps.entities = [...competitorEntities].filter(entity => !primaryEntities.has(entity));
    gaps.topics = [...competitorTopics].filter(topic => !primaryTopics.has(topic));

    return gaps;
  }

  private async generateContentOpportunities(gaps: any, topic?: string) {
    const opportunities = [];

    // Keyword opportunities
    gaps.keywords.slice(0, 10).forEach((keyword: string) => {
      opportunities.push({
        type: 'KEYWORD_OPPORTUNITY',
        keyword,
        suggestion: `Consider creating content around "${keyword}"`,
        priority: 'MEDIUM',
      });
    });

    // Entity opportunities
    gaps.entities.slice(0, 5).forEach((entity: string) => {
      opportunities.push({
        type: 'ENTITY_OPPORTUNITY',
        entity,
        suggestion: `Add content about "${entity}" to improve topical coverage`,
        priority: 'HIGH',
      });
    });

    return opportunities;
  }

  private async analyzeImages(content: any) {
    // Simplified image analysis
    return content.images?.map((img: any) => ({
      url: img.src,
      alt: img.alt || '',
      hasAlt: !!img.alt,
      seoScore: img.alt ? 100 : 20,
    })) || [];
  }

  private async extractEntities(content: any) {
    const text = content.text || '';
    const doc = compromise(text);
    
    // Extract named entities
    const people = doc.people().out('array');
    const places = doc.places().out('array');
    const organizations = doc.organizations ? doc.organizations().out('array') : [];
    
    const entities = [
      ...people.map((name: string) => ({ name, type: 'PERSON' })),
      ...places.map((name: string) => ({ name, type: 'PLACE' })),
      ...organizations.map((name: string) => ({ name, type: 'ORGANIZATION' })),
    ];

    return entities.slice(0, 20); // Limit to top 20 entities
  }

  private async calculateQualityScore(content: any) {
    const scores = {
      contentLength: this.scoreContentLength(content.wordCount || 0),
      readability: this.scoreReadability(content.text || ''),
      headingStructure: this.scoreHeadingStructure(content.headings || []),
      imageOptimization: this.scoreImages(content.images || []),
      technicalSEO: this.scoreTechnicalSEO(content),
    };

    const overall = Object.values(scores).reduce((sum, score) => sum + score, 0) / Object.keys(scores).length;

    return {
      overall: Math.round(overall),
      breakdown: scores,
    };
  }

  private scoreContentLength(wordCount: number): number {
    if (wordCount < 300) return 20;
    if (wordCount < 600) return 60;
    if (wordCount < 1000) return 80;
    if (wordCount < 2000) return 100;
    return 90; // Very long content might be too much
  }

  private scoreReadability(text: string): number {
    // Simplified readability scoring
    const sentences = text.split(/[.!?]+/).length;
    const words = text.split(/\s+/).length;
    const avgWordsPerSentence = words / sentences;
    
    if (avgWordsPerSentence < 15) return 100;
    if (avgWordsPerSentence < 20) return 80;
    if (avgWordsPerSentence < 25) return 60;
    return 40;
  }

  private scoreHeadingStructure(headings: string[]): number {
    if (headings.length === 0) return 0;
    if (headings.length < 3) return 40;
    if (headings.length < 6) return 80;
    return 100;
  }

  private scoreImages(images: any[]): number {
    if (images.length === 0) return 50; // Neutral if no images
    
    const withAlt = images.filter(img => img.alt).length;
    const altPercentage = withAlt / images.length;
    
    return Math.round(altPercentage * 100);
  }

  private scoreTechnicalSEO(content: any): number {
    let score = 0;
    
    // Title tag
    if (content.title) {
      if (content.title.length >= 30 && content.title.length <= 60) {
        score += 25;
      } else if (content.title.length > 0) {
        score += 15;
      }
    }
    
    // Meta description
    if (content.metaDescription) {
      if (content.metaDescription.length >= 120 && content.metaDescription.length <= 160) {
        score += 25;
      } else if (content.metaDescription.length > 0) {
        score += 15;
      }
    }
    
    // URL structure (simplified)
    if (content.url && !content.url.includes('?')) {
      score += 25;
    }
    
    // HTTPS (simplified check)
    if (content.url && content.url.startsWith('https://')) {
      score += 25;
    }
    
    return score;
  }

  private async technicalAnalysis(content: any) {
    return {
      hasTitle: !!content.title,
      titleLength: content.title?.length || 0,
      hasMetaDescription: !!content.metaDescription,
      metaDescriptionLength: content.metaDescription?.length || 0,
      headingCount: content.headings?.length || 0,
      imageCount: content.images?.length || 0,
      linkCount: content.links?.length || 0,
      isHTTPS: content.url?.startsWith('https://') || false,
    };
  }

  private async performDeepAnalysis(content: any) {
    // Deep analysis features for future enhancement
    return {
      semanticAnalysis: await this.analyzeSemanticContent(content),
      competitiveAnalysis: await this.getCompetitiveInsights(content),
      contentClusters: await this.identifyContentClusters(content),
    };
  }

  private async analyzeSemanticContent(content: any) {
    // Placeholder for semantic analysis
    return { semanticScore: 75 };
  }

  private async getCompetitiveInsights(content: any) {
    // Placeholder for competitive analysis
    return { competitiveScore: 60 };
  }

  private async identifyContentClusters(content: any) {
    // Placeholder for content clustering
    return { clusters: [] };
  }

  private async detectLanguage(text: string): string {
    // Simple language detection
    const commonWords = {
      en: ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of'],
      it: ['il', 'la', 'e', 'di', 'a', 'da', 'in', 'con', 'su', 'per'],
      es: ['el', 'la', 'y', 'de', 'a', 'en', 'un', 'es', 'se', 'no'],
      fr: ['le', 'de', 'et', 'un', 'il', 'être', 'et', 'en', 'avoir', 'que'],
    };

    const words = text.toLowerCase().split(/\s+/).slice(0, 100);
    const scores: { [key: string]: number } = {};

    Object.entries(commonWords).forEach(([lang, langWords]) => {
      scores[lang] = words.filter(word => langWords.includes(word)).length;
    });

    const detectedLang = Object.entries(scores).sort(([,a], [,b]) => b - a)[0];
    return detectedLang ? detectedLang[0] : 'en';
  }
}
