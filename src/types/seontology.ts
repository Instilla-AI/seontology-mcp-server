/**
 * SEOntology Type Definitions
 */

export interface WebPage {
  '@type': 'WebPage';
  '@id': string;
  url: string;
  title?: string;
  metaDescription?: string;
  bodyText?: string;
  hasQuery?: Query[];
  hasPrimaryQuery?: Query;
  hasChunk?: Chunk[];
  hasImage?: ImageObject[];
  hasLinkGroup?: LinkGroup[];
  mentions?: Thing[];
  hasEntityGap?: EntityGap[];
  hasQualityScore?: QualityScore;
}

export interface Query {
  '@type': 'Query';
  '@id': string;
  queryText: string;
  clicks?: number;
  ctr?: number;
  impressions?: number;
  queryType?: string;
  intent?: string;
}

export interface Thing {
  '@type': 'Thing';
  '@id': string;
  name: string;
  description?: string;
}

export interface EntityGap {
  '@type': 'EntityGap';
  '@id': string;
  missingEntity: string;
  relevanceScore?: number;
}

export interface QualityScore {
  '@type': 'QualityScore';
  '@id': string;
  contentAccuracyScore?: number;
  seoScore?: number;
  readabilityScore?: number;
}

export interface Chunk {
  '@type': 'Chunk';
  '@id': string;
  chunkText: string;
  chunkPosition: number;
}

export interface LinkGroup {
  '@type': 'LinkGroup';
  '@id': string;
  groupType: string;
  hasLink: Link[];
}

export interface Link {
  '@type': 'Link';
  '@id': string;
  targetUrl: string;
  anchorText?: string;
}

export interface ImageObject {
  '@type': 'ImageObject';
  '@id': string;
  contentUrl: string;
  altText?: string;
}

// Analysis Results
export interface SEOAnalysisResult {
  webpage: WebPage;
  entities: Thing[];
  gaps: EntityGap[];
  qualityScores: QualityScore;
  recommendations: string[];
  timestamp: string;
}

export interface ExtractedContent {
  url?: string;
  title?: string;
  metaDescription?: string;
  bodyText: string;
  headings: Array<{
    level: number;
    text: string;
    position: number;
  }>;
  links: Array<{
    url: string;
    text: string;
    type: 'internal' | 'external';
  }>;
  images: Array<{
    src: string;
    alt?: string;
  }>;
  wordCount: number;
}
