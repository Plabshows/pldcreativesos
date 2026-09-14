import {describe,it,expect} from 'vitest';
import {crmAlerts,crmForecast,crmWindowForecast,crmSchema,blankCrm,type CrmRecord} from '../lib/crm';
const record=(fields:Partial<CrmRecord>={}):CrmRecord=>({...blankCrm(),id:'test',created_at:'2026-09-01T12:00:00Z',last_activity_at:null,...fields});
describe('CRM essentials',()=>{
  it('forecasts open deals by close date, including day 30 and day 90',()=>{
    const values=['2026-09-12','2026-09-13','2026-10-13','2026-10-14','2026-12-12','2026-12-13',''].map(expected_close_date=>record({expected_close_date,estimated_value_cents:10000,probability_percent:50}));
    expect(crmWindowForecast([...values,record({stage:'won',expected_close_date:'2026-09-13',estimated_value_cents:99999})],new Date('2026-09-13T12:00:00Z'))).toEqual({days30:10000,days90:20000,withoutDate:1});
  });
  it('rejects invalid money, email, dates and probability',()=>{
    for(const fields of [{estimated_value_cents:-1},{estimated_value_cents:1.5},{email:'bad'},{event_date:'2026-02-31'},{probability_percent:101}])expect(crmSchema.safeParse({...blankCrm(),...fields}).success).toBe(false);
  });
  it('excludes closed deals from follow-up and weighted pipeline',()=>{
    const closed=record({stage:'won',estimated_value_cents:50000});
    expect(crmAlerts(closed,new Date('2026-09-20'))).toEqual({days:0,level:'none',missing:false,overdue:false});
    expect(crmForecast([closed,record({estimated_value_cents:1000000,probability_percent:50}),record({stage:'lost',estimated_value_cents:20000})])).toEqual({total:1000000,weighted:500000});
  });
  it('uses activity date and all three next-action fields',()=>{
    const now=new Date('2026-09-15T12:00:00Z');
    expect(crmAlerts(record(),now).level).toBe('red');
    expect(crmAlerts(record({last_activity_at:'2026-09-08T12:00:00Z'}),now).level).toBe('orange');
    expect(crmAlerts(record({last_activity_at:'2026-09-12T12:00:00Z'}),now).level).toBe('yellow');
    const planned=record({next_action:'Llamar',next_action_date:'2026-09-15',next_action_owner_id:'owner'});
    expect(crmAlerts(planned,now).missing).toBe(false);
    expect(crmAlerts(planned,now).overdue).toBe(false);
    expect(crmAlerts({...planned,next_action_owner_id:''},now).missing).toBe(true);
  });
});
