// Direct rules from Model.Instruction.CanInstructionSnapTo and
// Model.LoopInstruction.CanSnapInsideAsLeftMostInstruction (Assembly-CSharp).
const start=node=>['Start','StartOnMessage','StartOnKeyPress'].includes(node?.type);
const loop=node=>node?.type==='Repeat';
const same=(a,b)=>a===b||Boolean(a?.id&&a.id===b?.id);
// Compare attachment edges, not the pointer position. Coordinates are CSS pixels;
// tolerance scales with the canvas so zoom does not change the logical snap area.
export function attachmentDistance(dragged,target,side,scale=1){
 const dx=side==='after'?dragged.left-target.right:dragged.right-target.left;
 const dy=dragged.bottom-target.bottom;
 if(Math.abs(dx)>24*scale||Math.abs(dy)>32*scale)return Infinity;
 return Math.hypot(dx,dy)/scale;
}
export function canSnapInstruction({target,incoming,side,targetPrevious=null,targetNext=null,targetInsideLoop=false}){
 const nodes=Array.isArray(incoming)?incoming:[incoming],first=nodes[0];
 if(!target||!first||nodes.some(node=>same(node,target)))return false;
 if(side==='before'||side==='LeftSide'){
  // InstructionSnappingManager.ValidateRight passes the dragged chain's rightmost node.
  const last=nodes[nodes.length-1];
  if(targetPrevious||start(target)||targetInsideLoop||loop(last)&&!last.parameter)return false;
 }else if(side==='after'||side==='RightSide'){
  if(targetNext&&loop(first)&&(!first.parameter||!first.children?.length))return false;
  if(loop(target)&&!target.parameter)return false;
  if(targetInsideLoop&&nodes.some(loop))return false;
  if(start(first))return false;
 }else return false;
 return true;
}
export function canSnapInsideLoop({target,incoming,incomingPrevious=null,incomingInsideLoop=false}){
 const nodes=Array.isArray(incoming)?incoming:[incoming],first=nodes[0];
 if(!loop(target)||!first||nodes.some(node=>same(node,target)))return false;
 return !loop(first)&&!start(first)&&!incomingInsideLoop&&!incomingPrevious&&!nodes.some(loop);
}
// Instruction.CanAcceptLoop: placing an empty loop around an existing chain.
export function canWrapWithLoop({target,incomingLoop,targetPrevious=null,targetInsideLoop=false,rightAdjacent=[]}){
 if(!target||!loop(incomingLoop)||targetInsideLoop||loop(target)||incomingLoop.children?.length||start(target))return false;
 if(targetPrevious&&!start(targetPrevious)&&!loop(targetPrevious))return false;
 if(!incomingLoop.parameter&&rightAdjacent.some(loop))return false;
 return true;
}
