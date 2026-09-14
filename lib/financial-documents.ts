export const maxDocumentBytes=20*1024*1024;
export function documentMime(bytes:Uint8Array):string|null {
 const hex=Array.from(bytes.slice(0,8)).map(v=>v.toString(16).padStart(2,'0')).join('');
 const ascii=(start:number,end:number)=>String.fromCharCode(...bytes.slice(start,end));
 if(ascii(0,5)==='%PDF-')return 'application/pdf';
 if(hex.startsWith('ffd8ff'))return 'image/jpeg';
 if(hex==='89504e470d0a1a0a')return 'image/png';
 if(ascii(4,8)==='ftyp'&&['heic','heix','hevc','hevx','mif1','msf1'].includes(ascii(8,12)))return 'image/heic';
 return null;
}
