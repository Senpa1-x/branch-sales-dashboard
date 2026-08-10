const fs = require('fs');
const text = fs.readFileSync('/Users/macbook897/.gemini/antigravity/brain/7becb05f-6285-492c-b7f3-ee1b4f1502c2/.system_generated/steps/58/content.md', 'utf8');
const lines = text.split('\n');
const csvStart = lines.findIndex(l => l.startsWith('Repair,Repair Type'));
const csvText = lines.slice(csvStart).join('\n');

function parseCSV(text){
  const rows=[]; let row=[], field="", inQ=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(inQ){ if(c==='"'){ if(text[i+1]==='"'){field+='"';i++;} else inQ=false; } else field+=c; }
    else{
      if(c==='"') inQ=true;
      else if(c===','){ row.push(field); field=""; }
      else if(c==='\n'){ row.push(field); rows.push(row); row=[]; field=""; }
      else if(c!=='\r') field+=c;
    }
  }
  if(field!==""||row.length){ row.push(field); rows.push(row); }
  return rows;
}

const GCOL={ date:"Created Date", prod:"Product Name", status:"Repair Status", type:"Repair Type", issue1:"Customer Reported Component Issue", issue2:"Technician Verified Component Issue", cls:"Repair Classification", part:"Part Number" };
const CATS_GSX=["iPhone Display","iPhone Battery","iPhone Other","iPad","Watch","CPU","Airpods","ACC"];
const MONTHS_TH = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
function periodOf(m,yy){ return MONTHS_TH[m]+"'"+yy; }
const isCancelled = st => st.includes("DECLINED") || st.includes("CANCEL");

function mapGsx(prod, ctx){
  if(ctx.includes("SERVICE NON-REPAIR")) return "Service Non-Repair";
  if(prod.includes("AIRPODS")) return "Airpods";
  if(prod.includes("IPAD"))    return "iPad";
  if(prod.includes("WATCH"))   return "Watch";
  if(prod.includes("MAC") || prod.includes("STUDIO")) return "CPU";
  if(prod.includes("IPHONE") || ctx.includes("BATTERY") || ctx.includes("DISPLAY")){
    if(ctx.includes("BATTERY")) return "iPhone Battery";
    if(ctx.includes("DISPLAY")) return "iPhone Display";
    return "iPhone Other";
  }
  return "ACC";
}

const yy = "26";
const M=parseCSV(csvText);
const H=(M[0]||[]).map(h=>String(h||"").trim());
const idx={}; Object.keys(GCOL).forEach(k=>idx[k]=H.indexOf(GCOL[k]));

const out={};
const get=(row,k)=> idx[k]>-1 ? String(row[idx[k]]||"").toUpperCase() : "";

for(let r=1;r<M.length;r++){
  const row=M[r]; if(!row||!row.length) continue;
  
  // EXACT OLD REGEX
  const dm=String(row[idx.date]||"").trim().match(/^(\d{2})\/(\d{2})\/(\d{2})/);
  if(!dm) continue;
  const mi=parseInt(dm[1],10)-1, dyy=dm[3];
  
  if(mi<0||mi>11) continue;
  if(yy && dyy!==yy) continue;
  const period=periodOf(mi,dyy);

  let b=out[period];
  if(!b){ b=out[period]={total:0,nonRepair:0,cancelled:0, byCats:{}}; }

  const status=get(row,"status");
  if(isCancelled(status)){ b.cancelled++; continue; }
  const prod=get(row,"prod");
  const ctx=[get(row,"type"),prod,get(row,"issue1"),get(row,"issue2"),get(row,"cls"),get(row,"part")].join(" ");
  const mapped=mapGsx(prod,ctx);
  if(mapped==="Service Non-Repair"){ b.nonRepair++; continue; }
  
  if(!b.byCats[mapped]) b.byCats[mapped]=0;
  b.byCats[mapped]++;
  b.total++;
}

console.log(JSON.stringify(out["ก.ค.'26"], null, 2));
