export type SliceFilament={slot:number;grams:number|null;color:string|null;material:string|null};
export type SlicePlate={index:number;seconds:number|null;preparationSeconds:number|null;totalGrams:number|null;filaments:SliceFilament[];warnings:string[]};
export type SliceMetadata={source:string;plates:SlicePlate[];warnings:string[]};
export function parseFile(name:string,bytes:Uint8Array,inflate:(data:Uint8Array,max:number)=>Uint8Array):SliceMetadata;
export function parseGcode(text:string):SliceMetadata;
export function parseSliceInfo(text:string):SliceMetadata;
export function crc32(bytes:Iterable<number>):number;
