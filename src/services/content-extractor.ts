import axios from 'axios';
import * as cheerio from 'cheerio';

export class ContentExtractor {
  async extract(url: string) {
    try {
      const response = await axios.get(url, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SEOntology-MCP/1.0; +https://github.com/Instilla-AI/seontology-mcp-server)',
        },
      });

      const $ = cheerio.load(response.data);
      
      // Remove script and style elements
      $('script, style, nav, footer, .ads, .advertisement').remove();

      const content = {
        url,
        title: $('title').text().trim(),
        metaDescription: $('meta[name="description"]').attr('content') || '',
        metaKeywords: $('meta[name="keywords"]').attr('content') || '',
        canonicalUrl: $('link[rel="canonical"]').attr('href') || url,
        
        // Content extraction
        text: $('body').text().replace(/\s+/g, ' ').trim(),
        
        // Structured content
        headings: this.extractHeadings($),
        images: this.extractImages($),
        links: this.extractLinks($),
        
        // Meta information
        wordCount: 0,
        siteName: $('meta[property="og:site_name"]').attr('content') || '',
        publishedTime: $('meta[property="article:published_time"]').attr('content') || 
                      $('time[datetime]').attr('datetime') || '',
        
        // Schema.org data
        structuredData: this.extractStructuredData($),
        
        // OpenGraph data  
        openGraph: this.extractOpenGraph($),
      };

      // Calculate word count
      content.wordCount = content.text.split(/\s+/).filter(word => word.length > 0).length;

      return content;
    } catch (error) {
      throw new Error(`Failed to extract content from ${url}: ${error.message}`);
    }
  }

  private extractHeadings($: cheerio.CheerioAPI) {
    const headings: Array<{ level: number; text: string }> = [];
    
    $('h1, h2, h3, h4, h5, h6').each((i, element) => {
      const level = parseInt(element.tagName.charAt(1));
      const text = $(element).text().trim();
      if (text) {
        headings.push({ level, text });
      }
    });
    
    return headings;
  }

  private extractImages($: cheerio.CheerioAPI) {
    const images: Array<{ src: string; alt: string; title: string }> = [];
    
    $('img[src]').each((i, element) => {
      const src = $(element).attr('src');
      const alt = $(element).attr('alt') || '';
      const title = $(element).attr('title') || '';
      
      if (src) {
        images.push({ src, alt, title });
      }
    });
    
    return images;
  }

  private extractLinks($: cheerio.CheerioAPI) {
    const links: Array<{ href: string; text: string; rel: string }> = [];
    
    $('a[href]').each((i, element) => {
      const href = $(element).attr('href');
      const text = $(element).text().trim();
      const rel = $(element).attr('rel') || '';
      
      if (href && text) {
        links.push({ href, text, rel });
      }
    });
    
    return links;
  }

  private extractStructuredData($: cheerio.CheerioAPI) {
    const structuredData: any[] = [];
    
    $('script[type="application/ld+json"]').each((i, element) => {
      try {
        const data = JSON.parse($(element).html() || '{}');
        structuredData.push(data);
      } catch (error) {
        // Ignore malformed JSON-LD
      }
    });
    
    return structuredData;
  }

  private extractOpenGraph($: cheerio.CheerioAPI) {
    const og: { [key: string]: string } = {};
    
    $('meta[property^="og:"]').each((i, element) => {
      const property = $(element).attr('property');
      const content = $(element).attr('content');
      
      if (property && content) {
        const key = property.replace('og:', '');
        og[key] = content;
      }
    });
    
    return og;
  }
}
