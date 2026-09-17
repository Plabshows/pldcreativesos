import {normalizeTalent,talentCategories,talentCities} from './talent-categories';
type SearchableArtist={real_name:string;notes:string|null;skills?:string[]|null;aliases?:string[];city:string|null;email:string|null};
const words=(s:string)=>normalizeTalent(s).replace(/[^a-z0-9@]+/g,' ').trim().split(/\s+/).filter(Boolean);
const aliases:Record<string,string>={acrobata:'acrobacia',acrobatas:'acrobacia',acro:'acrobacia',bailarin:'danza',bailarina:'danza',bailarines:'danza',bailarinas:'danza',baile:'danza',dancer:'danza',dancers:'danza',cantantes:'canto',cantante:'canto',singer:'canto',zancudos:'zancos',bcn:'barcelona',eivissa:'ibiza'};
export function matchesTalent(artist:SearchableArtist,query:string){
 const haystack=words([artist.real_name,...(artist.aliases||[]),artist.notes,artist.city,artist.email,...talentCategories(artist.notes,artist.skills),...talentCities(artist.city)].join(' ')).join(' ');
 return words(query).every(word=>haystack.includes(word)||(aliases[word]&&haystack.includes(aliases[word])));
}
