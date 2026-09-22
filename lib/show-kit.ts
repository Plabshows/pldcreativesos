import {z} from 'zod';
export const sectionNames={sales:'Comercial',media:'Media / Sales Kit',tech:'Ficha técnica cliente',artist:'Brief del artista',warehouse:'Kit de almacén',maintenance:'Mantenimiento'} as const;
export type Section=keyof typeof sectionNames;
export const fieldLabels:Record<Section,Record<string,string>>={
 sales:{commercial_name:'Nombre comercial',short_description:'Descripción corta',long_description:'Descripción larga',tags:'Categorías / etiquetas',event_types:'Eventos recomendados',pricing:'Precio / referencias internas',website:'Página web',proposal_notes:'Información para propuestas'},
 media:{website:'Website URL',social:'Instagram / redes',folder:'Carpeta completa de material'},
 tech:{performers:'Número de performers',performance_type:'Tipo de performance',duration:'Duración de cada pase',sets:'Número de pases',preparation:'Tiempo de preparación',dressing_room:'Camerino',space:'Espacio necesario',power:'Electricidad',environment:'Interior / exterior',production:'Necesidades de producción',restrictions:'Restricciones',notes:'Otras notas técnicas',image:'Imagen principal (URL)'},
 artist:{clothing:'Ropa',base_layers:'Capas base',shoes:'Calzado',socks:'Calcetines',tshirt:'Camiseta / ropa de trabajo',personal:'Objetos personales',hair:'Pelo',hygiene:'Higiene',other:'Otros',do_not:'No traer / no llevar',behavior:'Cómo actuar',duration:'Duración del pase',breaks:'Descansos',instructions:'Instrucciones del personaje',safety:'Seguridad',how_to_wear:'Cómo vestirse',tutorial:'Vídeo tutorial (URL)',images:'Imágenes de referencia (URLs)'},
 warehouse:{checks:'Comprobar antes de salir (una comprobación por línea)'},
 maintenance:{cleaning:'Limpieza',charging:'Carga',battery:'Baterías',storage:'Conservación / almacenaje',problems:'Problemas conocidos',repairs:'Reparaciones',last:'Último mantenimiento',next:'Próximo mantenimiento',tutorials:'Vídeos tutoriales (URLs)'}
};
export function canReadSection(role:string,s:Section){return ['admin','producer'].includes(role)||(role==='sales'&&['sales','media','tech'].includes(s))||(role==='wardrobe'&&['warehouse','maintenance'].includes(s));}
const url=z.string().max(2000).refine(v=>!v||/^https?:\/\//i.test(v),'Utiliza una URL http o https.');
export const assetSchema=z.object({id:z.uuid(),label:z.string().max(200),url,kind:z.enum(['image','video','link']),hero:z.boolean(),best:z.boolean(),main:z.boolean(),approved:z.boolean()});
export const packingSchema=z.object({id:z.uuid(),name:z.string().min(1).max(200),image:url,quantity:z.number().int().min(1).max(10000),size:z.string().max(100),location:z.string().max(300),box:z.string().max(200),notes:z.string().max(3000),required:z.boolean(),condition:z.string().max(100),asset_id:z.string().max(200),concept_id:z.union([z.uuid(),z.literal('')])});
export const kitDocumentSchema=z.object({fields:z.record(z.string(),z.string().max(12000)).default({}),assets:z.array(assetSchema).max(100).default([]),items:z.array(packingSchema).max(200).default([])});
export type KitDocument=z.infer<typeof kitDocumentSchema>;
export const emptyDocument=():KitDocument=>({fields:{},assets:[],items:[]});
export function cleanDocument(section:Section,doc:KitDocument):KitDocument{return{fields:Object.fromEntries(Object.entries(doc.fields).filter(([k])=>k in fieldLabels[section])),assets:section==='media'?doc.assets:[],items:section==='warehouse'?doc.items:[]};}
export function packingForEvent(links:{show_id:string;quantity:number}[],kits:{show_id:string;document:KitDocument}[]){return links.flatMap(link=>(kits.find(k=>k.show_id===link.show_id)?.document.items||[]).map(item=>({...item,show_id:link.show_id,quantity:item.quantity*link.quantity})));}
export function clientSheet(doc:KitDocument){return Object.entries(fieldLabels.tech).filter(([k])=>k!=='image').map(([k,label])=>({label,value:doc.fields[k]||'Por confirmar'}));}
