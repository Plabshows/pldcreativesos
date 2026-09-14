/** Called only by a user gesture. Failure to copy must never open ChatGPT. */
export async function copyChatGPTContext(prompt:string,writeText:(text:string)=>Promise<void>,open?:()=>void){
 await writeText(prompt);
 open?.();
}
