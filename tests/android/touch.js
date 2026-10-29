// Use actual touch input for mobile page/section transitions in the WebView.
export async function touchTap(page,selector) {
 const target=page.locator(selector);await target.waitFor({state:'visible'});
 await target.scrollIntoViewIfNeeded();const box=await target.boundingBox();
 if(!box || !box.width || !box.height)throw new Error('Touch target is not visible: '+selector);
 const cdp=await page.context().newCDPSession(page);
 try {
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2,id:1}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 }finally{await cdp.detach();}
}
