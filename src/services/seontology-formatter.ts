export class SEOntologyFormatter {
  private readonly SEONTOLOGY_CONTEXT = {
    '@base': 'https://seontology.org/',
    'seo': 'https://seontology.org/',
    'schema': 'https://schema.org/',
    'rdfs': 'http://www.w3.org/2000/01/rdf-schema#',
  };

  formatPageAnalysis(url: string, analysis: any) {
    return {
      '@context': this.SEONTOLOGY_CONTEXT,
      '@type': 'seo:WebPage',
      'seo:hasURL': url,
      'seo:analyzedAt': new Date().toISOString(),
      
      // Basic properties
      'seo:title': analysis.basic?.title || '',
      'seo:metaDescription': analysis.basic?.metaDescription || '',
      'seo:wordCount': analysis.basic?.wordCount || 0,
      'seo:readingTime': analysis.basic?.readingTime || 0,
      'seo:language': analysis.basic?.language || 'en',
      
      // Chunks (headings as semantic chunks)
      'seo:hasChunk': this.formatChunks(analysis.basic?.headings || []),
      
      // Keywords as queries
      'seo:hasQuery': this.formatKeywordsAsQueries(analysis.keywords || []),
      
      // Images
      'seo:hasImage': this.formatImages(analysis.images || []),
      
      // Entities
      'seo:mentions': this.formatEntities(analysis.entities || []),
      
      // Quality scoring
      'seo:qualityScore': this.formatQualityScore(analysis.quality),
      
      // Technical SEO
      'seo:technicalSEO': this.formatTechnicalSEO(analysis.technical),
    };
  }

  formatKeywordAnalysis(url: string, keywords: any[]) {
    return {
      '@context': this.SEONTOLOGY_CONTEXT,
      '@type': 'seo:KeywordAnalysis',
      'seo:analyzedURL': url,
      'seo:analyzedAt': new Date().toISOString(),
      'seo:extractedKeywords': keywords.map(keyword => ({
        '@type': 'seo:Query',
        'seo:queryText': keyword.text,
        'seo:frequency': keyword.frequency,
        'seo:queryType': keyword.type,
        'seo:queryCategory': this.categorizeKeyword(keyword.text),
        'seo:variations': keyword.variations || [],
      })),
      'seo:totalKeywords': keywords.length,
    };
  }

  formatLinkAnalysis(url: string, linkAnalysis: any) {
    return {
      '@context': this.SEONTOLOGY_CONTEXT,
      '@type': 'seo:LinkAnalysis',
      'seo:analyzedURL': url,
      'seo:analyzedAt': new Date().toISOString(),
      
      // Internal links
      'seo:hasLink': linkAnalysis.internalLinks?.map((link: any) => ({
        '@type': 'seo:Link',
        'seo:linkURL': link.url,
        'seo:anchorText': link.anchorText,
        'seo:linkType': 'INTERNAL',
        'seo:isWorking': !linkAnalysis.brokenLinks?.some((broken: any) => broken.url === link.url),
      })) || [],
      
      // External links
      'seo:hasExternalLink': linkAnalysis.externalLinks?.map((link: any) => ({
        '@type': 'seo:Link',
        'seo:linkURL': link.url,
        'seo:anchorText': link.anchorText,
        'seo:linkType': 'EXTERNAL',
      })) || [],
      
      // Broken links
      'seo:hasBrokenLink': linkAnalysis.brokenLinks?.map((link: any) => ({
        '@type': 'seo:Link',
        'seo:linkURL': link.url,
        'seo:anchorText': link.anchorText,
        'seo:linkType': 'BROKEN',
        'seo:
