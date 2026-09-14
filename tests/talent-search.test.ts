import {describe,it,expect} from 'vitest';
import {matchesTalent} from '../lib/talent-search';
const artist={real_name:'María López García',notes:'Dancer. Aerial silks and acrobatics.',city:'Eivissa',email:null};
describe('talent search',()=>{
 it('finds partial names without accents, regardless of word order or extra spaces',()=>{for(const q of ['maria','LOPEZ','garcia maria','  maria   lopez ','mar lop'])expect(matchesTalent(artist,q)).toBe(true)});
 it('combines names, canonical skills and city aliases',()=>{for(const q of ['acro','acrobatas','bailarina','maria telas ibiza','bailarines eivissa'])expect(matchesTalent(artist,q)).toBe(true)});
 it('does not return unrelated names or skills',()=>{expect(matchesTalent(artist,'Pedro')).toBe(false);expect(matchesTalent(artist,'maria fuego')).toBe(false)});
 it('handles empty fields and empty search',()=>{expect(matchesTalent({real_name:'Sara',notes:null,city:null,email:null},'sara')).toBe(true);expect(matchesTalent(artist,'')).toBe(true)});
});
