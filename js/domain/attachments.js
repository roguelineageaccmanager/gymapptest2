// Setup metadata, not a new exercise identity or strength multiplier.
export const ATTACHMENTS={none:'Unspecified',handle:'Single handle',handles:'Handles',rope:'Rope',bar:'Straight bar',ezbar:'EZ bar',vbar:'V-bar',cuff:'Wrist cuff',ankle:'Ankle cuff',forearmcuff:'Forearm cuff',upperarmcuff:'Upper-arm cuff',shortrope:'Short rope',longrope:'Long rope',latbar:'Wide lat bar',neutralhandle:'Close-grip neutral handle',widehandle:'Wide neutral handle',strap:'Cable strap',liftingstraps:'Lifting straps'};
export function attachmentOptions(name){
 const n=String(name).toLowerCase();
 const grip=/\brows?\b|deadlift|\brdl\b|shrug|pull[ -]?up|chin[ -]?up|pulldown|rack pull/.test(n);
 const withGrip=options=>grip?[...options,'liftingstraps']:options;
 if(!/cable|pulldown|pushdown|rope (?:hammer|crunch)|face pull/.test(n)||/machine|plate.loaded|barbell|dumbbell/.test(n))return grip?['none','liftingstraps']:[];
 if(/rope/.test(n))return withGrip(['none','rope','shortrope','longrope']);
 if(/v.bar/.test(n))return withGrip(['none','vbar']);
 if(/straight.bar/.test(n))return withGrip(['none','bar']);
 if(/hip (?:abduct|adduct)|glute kickback|single.leg cable kickback/.test(n))return ['none','ankle'];
 if(/lateral raise|rear delt fly|front raise|cable fly/.test(n))return ['none','handle','cuff','forearmcuff','upperarmcuff','strap'];
 if(/single.arm.*(?:tricep|pushdown)/.test(n))return ['none','handle','cuff','strap','rope','shortrope','longrope'];
 if(/single.arm.*curl/.test(n))return ['none','handle','handles','cuff','strap','rope','shortrope','longrope','bar','ezbar','vbar'];
 if(/straight.arm.*pulldown/.test(n))return withGrip(['none','handle','handles','cuff','strap','rope','shortrope','longrope','bar','vbar','latbar','neutralhandle','widehandle']);
 if(/curl|tricep|pushdown|crunch|face pull/.test(n))return ['none','handle','handles',...(/curl|tricep|pushdown/.test(n)?['cuff']:[]),'strap','rope','shortrope','longrope','bar','ezbar','vbar'];
 if(/row|pulldown|fly|press|wood chop|woodchop|pullover/.test(n))return withGrip(['none','handle','handles',...(/row|pulldown|fly/.test(n)?['cuff']:[]),'strap','rope','shortrope','longrope','bar','vbar',...(/row|pulldown/.test(n)?['latbar','neutralhandle','widehandle']:[])]);
 return [];
}
export function attachmentFor(name,value){return typeof value==='string'&&attachmentOptions(name).includes(value)?value:undefined;}
export const attachmentLabel=exercise=>ATTACHMENTS[attachmentFor(exercise.name,exercise.attachment)]||'';

export function attachmentHint(exercise,value){
 if(value==='liftingstraps')return 'Grip aid wrapped around the handle or bar';
 if(value==='strap')return 'Strap connected directly to the cable';
 if(!/cuff/.test(value))return '';
 return exercise.unilateral?'One cuff on the working arm':'One cuff per working arm';
}
