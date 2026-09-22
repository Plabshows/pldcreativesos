// Only client-facing copy is mapped into proposals. Pricing and private notes stay internal.
export function commercialShow<T extends {name:string;description?:string|null;category?:string|null}>(show:T,fields:Record<string,string>={}){
 return {...show,name:fields.commercial_name?.trim()||show.name,description:fields.long_description?.trim()||fields.short_description?.trim()||show.description,category:fields.tags?.trim()||show.category};
}
