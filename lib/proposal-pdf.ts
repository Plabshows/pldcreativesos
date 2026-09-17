import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {proposalText,type ProposalFields} from './proposals';
export async function proposalPdf(fields:ProposalFields,code=''){
 const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);
 doc.setTitle(fields.title);doc.setAuthor('Performance Lab');
 let page=doc.addPage([595.28,841.89]),y=0;const width=491;
 const safe=(s:string)=>Array.from(s.replace(/[\u2011\u2013\u2014]/g,'-').replace(/\u2212/g,'-')).filter(c=>{try{font.encodeText(c);return true;}catch{return false;}}).join('');
 function header(){page.drawRectangle({x:0,y:738,width:595.28,height:104,color:rgb(.15,.12,.22)});page.drawText('PERFORMANCE LAB',{x:52,y:790,size:21,font:bold,color:rgb(1,1,1)});page.drawText(fields.language==='en'?'ENTERTAINMENT PROPOSAL':'PROPUESTA DE ESPECTÁCULOS',{x:52,y:766,size:9,font,color:rgb(.82,.76,.94)});y=704;}
 function next(){page=doc.addPage([595.28,841.89]);header();}
 header();
 const text=proposalText(fields,code).split('\n').slice(1);
 for(const raw of text){if(!raw){y-=10;continue;}const line=safe(raw);const emphasis=line===safe(fields.title)||line.startsWith('TOTAL:')||fields.options.some(o=>line.endsWith(safe(o.title)));
  const face=emphasis?bold:font,size=line===safe(fields.title)?18:emphasis?12:10.5;
  const words=line.split(/\s+/);let current='';const lines:string[]=[];
  for(const word of words){if(face.widthOfTextAtSize(word,size)>width){if(current){lines.push(current);current='';}let part='';for(const c of word){if(face.widthOfTextAtSize(part+c,size)>width){lines.push(part);part='';}part+=c;}current=part;}
   else if(face.widthOfTextAtSize(current?current+' '+word:word,size)>width){lines.push(current);current=word;}else current=current?current+' '+word:word;
  }if(current)lines.push(current);
  if(emphasis)y-=7;
  for(const row of lines){if(y<67)next();page.drawText(row,{x:52,y,size,font:face,color:emphasis?rgb(.32,.21,.5):rgb(.25,.23,.29)});y-=size*1.5;}
 }
 const pages=doc.getPages();pages.forEach((p,i)=>{p.drawLine({start:{x:52,y:47},end:{x:543,y:47},thickness:.5,color:rgb(.85,.82,.9)});p.drawText(safe(code||'Performance Lab'),{x:52,y:31,size:8,font,color:rgb(.55,.5,.6)});p.drawText(`${i+1} / ${pages.length}`,{x:510,y:31,size:8,font,color:rgb(.55,.5,.6)});});
 return doc.save();
}
