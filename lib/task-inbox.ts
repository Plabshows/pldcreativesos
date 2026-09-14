import {taskOverdue,type WorkTaskFields} from './work-tasks';
export type InboxTask=WorkTaskFields&{id:string;version:number;unread:boolean};
const rank={urgent:0,high:1,medium:2,low:3};
export function orderInbox(tasks:InboxTask[],now=new Date()){
 return [...tasks].sort((a,b)=>Number(taskOverdue(b,now))-Number(taskOverdue(a,now))||Number(b.unread)-Number(a.unread)||rank[a.priority]-rank[b.priority]||(a.deadline||'9999').localeCompare(b.deadline||'9999'));
}
