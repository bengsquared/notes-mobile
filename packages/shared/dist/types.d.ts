export interface Note {
    id: string;
    content: string;
    createdAt: string;
    updatedAt: string;
    tags?: string[];
}
export interface DeepNote extends Note {
    title: string;
    linkedNotes?: string[];
    collections?: string[];
    processed: boolean;
}
export interface Collection {
    id: string;
    name: string;
    color?: string;
    noteIds: string[];
}
export interface TransferPayload {
    notes: Note[];
    timestamp: string;
}
export interface RPCRequest {
    method: string;
    params?: any;
    id?: string | number;
}
export interface RPCResponse {
    result?: any;
    error?: {
        code: number;
        message: string;
    };
    id?: string | number;
}
