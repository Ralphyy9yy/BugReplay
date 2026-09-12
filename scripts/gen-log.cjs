const fs = require('fs');

function isoTime(d) { return d.toISOString(); }
function addMs(d, ms) { return new Date(d.getTime() + ms); }
function randItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

const BASE = new Date('2024-01-15T08:00:00.000Z');
const ORDERS = ['ord_7f3a9b2c','ord_4e1d8f5a','ord_9c6b2e1f','ord_3a5d7c8e','ord_1b4f9e2d','ord_6c8a3f7b'];
const CUSTS = ['cust_001','cust_002','cust_003','cust_004','cust_005','cust_006'];
const REQS = ['req_a1b2c3d4','req_e5f6a7b8','req_c9d0e1f2','req_a3b4c5d6','req_e7f8a9b0','req_c1d2e3f4'];
const ENDS = ['/api/checkout','/api/payment/process','/api/orders','/api/auth/login','/api/cart','/api/products'];

function httpLog(ts, method, ep, status, ms) { return isoTime(ts)+' INFO '+method+' '+ep+' '+status+' '+ms+'ms - requestId='+randItem(REQS); }
function infoLog(ts, msg) { return isoTime(ts)+' INFO '+msg; }
function warnLog(ts, msg) { return isoTime(ts)+' WARN '+msg; }
function errorLog(ts, msg) { return isoTime(ts)+' ERROR '+msg; }

function typeErrStack(ts, oid, cid, rid) {
  return [
    errorLog(ts, 'Unhandled error processing checkout for order '+oid+' - requestId='+rid+' customerId='+cid),
    "TypeError: Cannot read properties of undefined (reading 'id')",
    '    at processCheckout (/app/src/checkout.ts:84:26)',
    '    at async handleCheckoutRequest (/app/src/routes/checkout.ts:31:22)',
    '    at async Layer.handle [as handle_request] (/app/node_modules/express/lib/router/layer.js:95:5)',
    '    at next (/app/node_modules/express/lib/router/route.js:144:13)',
    '    at Route.dispatch (/app/node_modules/express/lib/router/route.js:114:3)',
    '    at /app/src/middleware/auth.ts:22:5'
  ];
}

function authErrStack(ts, uname, rid) {
  return [
    errorLog(ts, 'Authentication error for user '+uname+' - requestId='+rid),
    "TypeError: Cannot read properties of null (reading 'toLowerCase')",
    '    at getUserEmail (/app/src/auth.ts:68:18)',
    '    at sendWelcomeEmail (/app/src/notifications.ts:44:22)',
    '    at async afterAuthMiddleware (/app/src/middleware/auth.ts:89:5)',
    '    at Layer.handle [as handle_request] (/app/node_modules/express/lib/router/layer.js:95:5)'
  ];
}

function dbErrStack(ts, oid) {
  return [
    errorLog(ts, 'Database error while saving order '+oid),
    'Error: Cannot call method on null - database not initialized',
    '    at InMemoryDatabase.assertInitialized (/app/src/db.ts:51:13)',
    '    at InMemoryDatabase.saveOrder (/app/src/db.ts:57:10)',
    '    at async processCheckout (/app/src/checkout.ts:90:5)',
    '    at async handleCheckoutRequest (/app/src/routes/checkout.ts:31:22)'
  ];
}

const lines = [];
let ts = BASE;

// Startup
lines.push(infoLog(ts, 'Payment API server starting...'));
ts = addMs(ts,100); lines.push(infoLog(ts, 'Loading environment configuration'));
ts = addMs(ts,50);  lines.push(infoLog(ts, 'Connecting to database...'));
ts = addMs(ts,200); lines.push(infoLog(ts, 'Database connection established'));
ts = addMs(ts,100); lines.push(infoLog(ts, 'Payment gateway client initialized'));
ts = addMs(ts,50);  lines.push(infoLog(ts, 'Express server listening on port 3000'));

// Normal traffic - pre-refactor
for(let i=0;i<100;i++){
  ts=addMs(ts,randInt(100,800));
  const ep=randItem(ENDS.filter(e=>e!=='/api/checkout'));
  lines.push(httpLog(ts,'GET',ep,200,randInt(15,180)));
}

ts=addMs(ts,2000);
lines.push(infoLog(ts,'Payment refactor deployed - version 2.1.3'));
ts=addMs(ts,500);
lines.push(infoLog(ts,'COMMIT a72fd1e: Refactor payment processing - updated response mapper'));

let ce=0,ae=0,de=0;
for(let i=0;i<500;i++){
  ts=addMs(ts,randInt(200,1500));
  const roll=Math.random();
  if(roll<0.08 && ce<14){
    const oid=randItem(ORDERS),cid=randItem(CUSTS),rid=randItem(REQS);
    ts=addMs(ts,randInt(10,50));
    lines.push(httpLog(ts,'POST','/api/checkout',200,randInt(20,60)));
    ts=addMs(ts,randInt(50,150));
    lines.push(infoLog(ts,'Processing checkout for order '+oid+' - customerId='+cid));
    ts=addMs(ts,randInt(30,80));
    lines.push(infoLog(ts,'Payment gateway called - amount='+randInt(1000,9999)+' currency=USD'));
    ts=addMs(ts,randInt(60,200));
    lines.push(infoLog(ts,'Payment gateway response received - status=success (no id in response)'));
    ts=addMs(ts,randInt(10,30));
    typeErrStack(ts,oid,cid,rid).forEach(function(l){lines.push(l);});
    ts=addMs(ts,50);
    lines.push(httpLog(ts,'POST','/api/checkout',500,randInt(200,800)));
    ce++;
  } else if(roll<0.12 && ae<8){
    const uname=randItem(['bob','charlie','diana','eve']),rid=randItem(REQS);
    lines.push(httpLog(ts,'POST','/api/auth/login',200,randInt(30,100)));
    ts=addMs(ts,randInt(20,60));
    lines.push(infoLog(ts,'User '+uname+' authenticated successfully'));
    ts=addMs(ts,randInt(10,30));
    lines.push(infoLog(ts,'Sending welcome notification to '+uname));
    ts=addMs(ts,randInt(20,50));
    authErrStack(ts,uname,rid).forEach(function(l){lines.push(l);});
    ae++;
  } else if(roll<0.15 && de<5){
    const oid=randItem(ORDERS);
    lines.push(infoLog(ts,'Database connection pool health check initiated'));
    ts=addMs(ts,randInt(50,150));
    dbErrStack(ts,oid).forEach(function(l){lines.push(l);});
    de++;
  } else {
    const ep=randItem(ENDS);
    const meth=ep.includes('checkout')?'POST':Math.random()<0.3?'POST':'GET';
    const status=Math.random()<0.01?404:Math.random()<0.005?503:200;
    lines.push(httpLog(ts,meth,ep,status,randInt(15,300)));
    if(Math.random()<0.02){ts=addMs(ts,randInt(10,30));lines.push(warnLog(ts,'Slow query detected: '+randInt(500,2000)+'ms on orders table'));}
    if(Math.random()<0.01){ts=addMs(ts,randInt(5,15));lines.push(warnLog(ts,'Payment gateway response time elevated: '+randInt(800,2000)+'ms'));}
  }
}

for(let i=0;i<80;i++){ts=addMs(ts,randInt(100,500));lines.push(httpLog(ts,'GET',randItem(ENDS),200,randInt(10,200)));}
lines.push(infoLog(ts,'Server stats: '+lines.length+' total log lines processed'));

fs.mkdirSync('demo/logs',{recursive:true});
fs.writeFileSync('demo/logs/server.log', lines.join('\n')+'\n');
console.log('Generated server.log: '+lines.length+' lines, checkout_errors='+ce+' auth_errors='+ae+' db_errors='+de);

