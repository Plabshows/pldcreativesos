import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {clientSheet,type KitDocument} from './show-kit';
export async function showTechPdf(name:string,doc:KitDocument,loadShowImage:(url:string)=>Promise<Uint8Array>){
 const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);let page=pdf.addPage(),y=790;
 const text=(value:string,size=11)=>{const safe=Array.from(value).map(c=>{try{font.encodeText(c);return c;}catch{return '?';}}).join('');for(const line of safe.split('\n')){let part='';for(const word of line.split(' ')){if(font.widthOfTextAtSize(part+' '+word,size)>480&&part){draw(part,size);part='';}part+=(part?' ':'')+word;}draw(part,size);}};
 const draw=(line:string,size:number)=>{if(y<55){page=pdf.addPage();y=790;}page.drawText(line,{x:50,y,size,font,color:rgb(.14,.13,.2)});y-=size+7;};
 text('PERFORMANCE LAB · FICHA TÉCNICA',12);text(name,22);y-=12;
 if(doc.fields.image?.trim()){
 try{const bytes=await loadShowImage(doc.fields.image.trim());const image=bytes[0]===137?await pdf.embedPng(bytes):await pdf.embedJpg(bytes);const scale=Math.min(480/image.width,240/image.height);const width=image.width*scale,height=image.height*scale;page.drawImage(image,{x:50+(480-width)/2,y:y-height,width,height});y-=height+24;}
 catch{throw Error('No se pudo incluir la imagen. Utiliza un enlace HTTPS directo a una foto JPG o PNG pública de hasta 5 MB.');}
 }
 for(const row of clientSheet(doc)){text(row.label,12);text(row.value);y-=8;}
 return new Uint8Array(await pdf.save());
}
