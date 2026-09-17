import {describe,it,expect} from 'vitest';import {newTask,workTaskSchema,taskOverdue} from '../lib/work-tasks';
describe('Team tasks',()=>{
 it('validates people/relations, dates and title',()=>{const t={...newTask(),title:'Seguimiento'};expect(workTaskSchema.safeParse(t).success).toBe(true);for(const patch of [{owner_id:'someone'},{title:''},{deadline:'tomorrow'},{status:'unknown'}])expect(workTaskSchema.safeParse({...t,...patch}).success).toBe(false);});
 it('closed tasks are never overdue and missing dates remain unplanned',()=>{const t={...newTask(),title:'Seguimiento',deadline:'2026-09-01T10:00:00Z'};const now=new Date('2026-09-13T10:00:00Z');expect(taskOverdue(t,now)).toBe(true);expect(taskOverdue({...t,status:'done'},now)).toBe(false);expect(taskOverdue({...t,status:'cancelled'},now)).toBe(false);expect(taskOverdue({...t,deadline:''},now)).toBe(false);});
});
