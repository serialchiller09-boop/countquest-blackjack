// EMERGENCY Sounds stub — full 06b restore follows
function createSoundsNoopStub(){return{enabled:true,setEnabled(){},init(){},play(){},tone(){}};}
var Sounds=createSoundsNoopStub();
window.Sounds=Sounds;
const Storage={load(){try{let r=localStorage.getItem(typeof SAVE_KEY!=='undefined'?SAVE_KEY:'countquest-v2');if(!r)return null;return JSON.parse(r);}catch(e){return null;}},save(d){try{localStorage.setItem(typeof SAVE_KEY!=='undefined'?SAVE_KEY:'countquest-v2',JSON.stringify(d));return{ok:true};}catch(e){return{ok:false,error:String(e)};}},reset(){try{localStorage.removeItem(typeof SAVE_KEY!=='undefined'?SAVE_KEY:'countquest-v2');}catch(e){}}};
function defaultSave(){return{version:typeof SAVE_VERSION!=='undefined'?SAVE_VERSION:1,stats:typeof defaultStats==='function'?defaultStats():{},bankroll:2500,chips:2500,gems:10,settings:{practiceMode:false,numDecks:6,startingBankroll:1000,minBet:10,unitSize:10,soundEnabled:true,theme:'classic',rules:typeof defaultRules==='function'?defaultRules():{},countingSystem:'hi-lo',showCountDisplay:true,showCountPopups:true,useIndexDeviations:true,tableLayout:'solo'},countingUnlocks:['hi-lo'],achievements:[],sessionActive:false};}
function validateAndRepairSave(data){if(!data||typeof data!=='object')return{ok:false,error:'missing'};const repaired=typeof migrateSave==='function'?migrateSave(data):data;return{ok:true,value:repaired};}
function parseBoundedInteger(rawValue,options={}){const{fieldName='Value',min=-Infinity,max=Infinity,required=true}=options;const trimmed=String(rawValue??'').trim();if(!trimmed)return required?{ok:false,error:fieldName+' is required'}:{ok:true,value:null};if(!/^-?\d+$/.test(trimmed))return{ok:false,error:fieldName+' must be a whole number'};const value=parseInt(trimmed,10);if(!Number.isFinite(value)||value<min||value>max)return{ok:false,error:fieldName+' out of range'};return{ok:true,value};}
function validateRunningCountGuess(rawValue,shoe=null){const decks=shoe?.numDecks||6;return parseBoundedInteger(rawValue,{fieldName:'Running count',min:-(decks*22+15),max:decks*22+15});}
function validateBetAmount(rawAmount,bankroll,minBet,options={}){const{practice=false}=options;const upper=practice?1000000:Math.max(minBet,Math.floor(bankroll));const parsed=parseBoundedInteger(rawAmount,{fieldName:'Bet',min:minBet,max:upper});if(!parsed.ok)return parsed;if(!practice&&parsed.value>bankroll)return{ok:false,error:'Bet cannot exceed bankroll'};return parsed;}
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
function buildCountGuideHtml(){return '';}
function recommendedBetWhyText(){return '';}
const PHASE_SCREEN_IDS={menu:'screen-menu',training:'screen-training',bet:'screen-casino-play',playing:'screen-casino-play',handEnd:'screen-casino-play'};
function lobbyTapFeedback(kind='tap'){try{Sounds.init();Sounds.play(kind);}catch(_){}}
function bumpCurrencyEl(el,newVal){if(!el)return;el.textContent=String(newVal);}
function showModalPremium(id){const d=document.getElementById(id);if(!d)return null;try{d.showModal();}catch(_){}return d;}
