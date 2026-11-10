import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const server=spawn('python3',['-m','http.server','8765','--bind','127.0.0.1'],{stdio:'ignore'});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const base='http://127.0.0.1:8765/index.html';
let browser;
try{
 await wait(1200);
 browser=await chromium.launch({headless:true});
 for(const viewport of [{width:390,height:844},{width:1280,height:800}]){
  const context=await browser.newContext({viewport,serviceWorkers:'block'});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base,{waitUntil:'load'});
  await page.locator('#dailyMissionLaunch').click();
  assert.equal(await page.locator('#mixedMissionArea .scenarioChoice').count(),4,'Mission must show four options');
  for(let n=0;n<8;n++){
   await page.locator('#mixedMissionArea .scenarioChoice').first().click();
   await page.waitForTimeout(120);
   const next=page.locator('#mixedMissionArea button.primary').last();
   await next.click();
  }
  await assert.doesNotReject(()=>page.locator('#mixedMissionArea').getByText(/Mission geschafft: /).waitFor());
  await page.getByRole('button',{name:/Meinen Lernfortschritt ansehen/}).click();
  assert.match(await page.locator('#missionProgressSummary').innerText(),/1 abgeschlossene Mission/);
  assert.match(await page.locator('#learningDashboard').innerText(),/Tagesmissionen/);
  // Wortschatztest mit fünf Fragen: Abschluss, Speicherung, erneutes Laden
  await page.locator('[data-tab="english"]').click();
  await page.locator('[data-learning="quiz"]').click();
  await page.locator('#quizLength').selectOption('5');
  await page.locator('#quizStart').click();
  for(let n=0;n<5;n++){
   await page.locator('#quizArea .scenarioChoice').first().click();
   await page.locator('#quizArea button.primary').last().click();
  }
  assert.match(await page.locator('#quizArea').innerText(),/von 5 richtig/);
  await page.locator('[data-tab="progress"]').click();
  assert.match(await page.locator('#learningDashboard').innerText(),/1 Wortschatz-Tests/);
  // Situationsrunde: Ergebnis muss nach Abschluss in Statistik erscheinen
  await page.locator('[data-tab="english"]').click();
  await page.locator('[data-learning="quiz"]').click();
  await page.locator('#scenarioTopic').selectOption('kids');
  await page.locator('#scenarioStart').click();
  for(let n=0;n<3;n++){
   await page.locator('#scenarioArea button:not(.primary)').first().click();
   await page.locator('#scenarioArea button.primary').last().click();
  }
  await page.locator('[data-tab="progress"]').click();
  assert.match(await page.locator('#learningDashboard').innerText(),/Situationsverständnis/);
  assert.match(await page.locator('#learningDashboard').innerText(),/1 abgeschlossene Runden/);
  await page.reload();
  await page.locator('[data-tab="progress"]').click();
  assert.match(await page.locator('#missionProgressSummary').innerText(),/1 abgeschlossene Mission/,'Mission must survive reload');
  await page.locator('#statsArea').selectOption('vocab');
  assert.match(await page.locator('#learningDashboard').innerText(),/Hockey-Tests/);
  await page.locator('#statsArea').selectOption('rink');
  assert.match(await page.locator('#learningDashboard').innerText(),/Expertenmodus/);
  await page.locator('#statsArea').selectOption('skills');
  assert.match(await page.locator('#learningDashboard').innerText(),/Torwartkompetenzen/);
  assert.deepEqual(errors,[],'No uncaught JavaScript errors');
  await context.close();
  console.log('PASS: '+viewport.width+'px mission, vocabulary quiz, scenario, persistence, dashboard filters, no runtime errors');
 }
}finally{await browser?.close();server.kill()}
