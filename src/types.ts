export enum AppStatus {
  IDLE = 'IDLE',
  DECOMPOSING = 'DECOMPOSING',
  PREVIEWING = 'PREVIEWING',
  ASSEMBLING = 'ASSEMBLING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export enum ExtractionMode {
  BALANCED = 'BALANCED',
  TEXT_FOCUS = 'TEXT_FOCUS',
  COMPONENTS = 'COMPONENTS',
  FULL_IMAGE = 'FULL_IMAGE'
}

export interface SlideConfig {
  pageNumber: number;
  previewUrl: string;
  mode: ExtractionMode;
  enabled: boolean;
}

export interface ImagePart {
  type: 'photo';
  data: string; // Base64
  x: number; y: number; w: number; h: number;
  order: number;
}

export interface TextPart {
  text: string;
  x: number; y: number; w: number; h: number;
  fontSize?: number;
  color?: string;
  align?: "left" | "center" | "right";
  isBold?: boolean;
}

export interface ShapePart {
  type: "rect" | "circle" | "line";
  x: number; y: number; w: number; h: number;
  color?: string;
}

export interface SlideStructure {
  backgroundColor: string;
  elements: {
    text: TextPart[];
    shapes: ShapePart[];
    images: ImagePart[];
  };
  // クライアント側で切り抜くための情報
  rawImageInstructions?: {
    description: string;
    box: [number, number, number, number]; // [ymin, xmin, ymax, xmax]
    order: number;
  }[];
}