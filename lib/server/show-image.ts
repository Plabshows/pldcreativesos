import {lookup} from 'node:dns/promises';
import {request} from 'node:https';
export function isPublicIPv4(ip:string){const p=ip.split('.').map(Number);if(p.length!==4||p.some(n=>!Number.isInteger(n)||n<0||n>255))return false;const [a,b]=p;return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0)||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19||b===51)||a===203&&b===0);}
export async function loadShowImage(raw:string,redirects=0):Promise<Uint8Array>{
 const url=new URL(raw);if(url.protocol!=='https:'||url.username||url.password||url.port&&url.port!=='443'||redirects>3)throw Error('La imagen debe usar HTTPS público.');
 const addresses=await lookup(url.hostname,{all:true,family:4});if(!addresses.length||addresses.some(a=>!isPublicIPv4(a.address)))throw Error('La dirección de la imagen no está permitida.');
 const response=await new Promise<{location?:string;bytes?:Uint8Array}>((resolve,reject)=>{
 const req=request(url,{lookup:((_host:unknown,options:{all?:boolean},callback:Function)=>options.all?callback(null,addresses.map(a=>({address:a.address,family:4}))):callback(null,addresses[0].address,4)) as never,signal:AbortSignal.timeout(10000),headers:{Accept:'image/png,image/jpeg'}},res=>{
 if([301,302,303,307,308].includes(res.statusCode||0)){const location=res.headers.location;res.resume();if(location)resolve({location});else reject(Error('Redirección de imagen no válida.'));return;}
 if(res.statusCode!==200){res.resume();reject(Error('No se pudo descargar la imagen.'));return;}
 const chunks:Buffer[]=[];let size=0;res.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>5*1024*1024){res.destroy();reject(Error('La imagen supera 5 MB.'));}else chunks.push(chunk);});res.on('error',reject);res.on('end',()=>resolve({bytes:Buffer.concat(chunks)}));
 });req.on('error',reject);req.end();
 });
 if(response.location)return loadShowImage(new URL(response.location,url).href,redirects+1);
 return response.bytes!;
}
