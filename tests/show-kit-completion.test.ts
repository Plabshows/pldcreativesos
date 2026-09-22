import {it,expect} from 'vitest';
import {PDFDocument,PDFName} from 'pdf-lib';
import {commercialShow} from '../lib/show-commercial';
import {showTechPdf} from '../lib/show-tech-pdf';
import {emptyDocument} from '../lib/show-kit';
import {isPublicIPv4} from '../lib/server/show-image';
it('uses commercial copy with legacy fallback and excludes private pricing',()=>{
 const original={id:'s',name:'Old',description:'Legacy',category:'Dance'};
 expect(commercialShow(original,{commercial_name:'New',long_description:'Client text',pricing:'SECRET',proposal_notes:'PRIVATE'})).toEqual({...original,name:'New',description:'Client text'});
 expect(commercialShow(original,{})).toEqual(original);
});
it('blocks local and metadata addresses for image downloads',()=>{
 for(const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','172.16.0.1','192.168.0.2','100.64.0.1','0.0.0.0','::1'])expect(isPublicIPv4(ip)).toBe(false);
 expect(isPublicIPv4('8.8.8.8')).toBe(true);
});
it('embeds a photo in the PDF and fails explicitly for inaccessible photos',async()=>{
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6XkAAAAASUVORK5CYII=','base64');
 const doc={...emptyDocument(),fields:{image:'https://example.com/photo.png',duration:'15 minutos',pricing:'PRIVATE'}};
 const bytes=await showTechPdf('TV HEADS',doc,async()=>png),pdf=await PDFDocument.load(bytes);
 expect(pdf.getPages()[0].node.Resources()?.has(PDFName.of('XObject'))).toBe(true);
 await expect(showTechPdf('TV HEADS',doc,async()=>{throw Error('Unavailable');})).rejects.toThrow('No se pudo incluir la imagen');
});
