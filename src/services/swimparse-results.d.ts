declare module 'swimparse' {
 export function parse(text:string,options?:{filename:string}):{events:{type:string;number:string;results:{kind:string;relayLetter?:string;legs?:{name:string;legOrder:number}[];finalTime?:{seconds:number}|null}[]}[]};
}