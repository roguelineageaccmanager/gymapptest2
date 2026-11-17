// Setup metadata, not a new exercise identity or strength multiplier.
export const ATTACHMENTS={none:'Unspecified',handle:'Single handle',handles:'Handles',rope:'Rope',bar:'Straight bar',ezbar:'EZ bar',vbar:'V-bar',cuff:'Wrist cuff',ankle:'Ankle cuff'};
export function attachmentOptions(name){
 const n=String(name).toLowerCase();
 if(!/cable|pulldown|pushdown|rope (?:hammer|crunch)|face pull/.test(n)||/machine|plate.loaded|barbell|dumbbell/.test(n))return [];
 if(/rope/.test(n))return ['none','rope'];
 if(/v.bar/.test(n))return ['none','vbar'];
 if(/straight.bar/.test(n))return ['none','bar'];
 if(/hip (?:abduct|adduct)|glute kickback|single.leg cable kickback/.test(n))return ['none','ankle'];
 if(/lateral raise|rear delt fly|front raise|single.arm.*(?:tricep|pushdown)/.test(n))return ['none','handle','cuff'];
 if(/curl|tricep|pushdown|crunch|face pull/.test(n))return ['none','handle','handles','rope','bar','ezbar','vbar'];
 if(/row|pulldown|fly|press|wood chop|woodchop|pullover/.test(n))return ['none','handle','handles','rope','bar','vbar'];
 return [];
}
export function attachmentFor(name,value){return typeof value==='string'&&attachmentOptions(name).includes(value)?value:undefined;}
export const attachmentLabel=exercise=>ATTACHMENTS[attachmentFor(exercise.name,exercise.attachment)]||'';
