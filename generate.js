const fs = require('fs');
const path = require('path');

const DB_URL = 'https://rosho-c2d11-default-rtdb.firebaseio.com/classes.json';
const DIST_DIR = path.join(__dirname, 'dist');
const BASE_URL = 'https://qclasses.netlify.app';

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function svgIcon(type) {
  if (type === 'class') return '<svg class="card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>';
  if (type === 'subject') return '<svg class="card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>';
  if (type === 'chapter') return '<svg class="card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>';
  if (type === 'question') return '<svg class="card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
  return '';
}

function generateSlug(text) {
  if (!text) return 'item';
  return String(text).toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function injectMeta(html, opts) {
  let res = html;
  res = res.replace(/<title>.*?<\/title>/g, `<title>${escapeHtml(opts.title)}</title>`);
  res = res.replace(/<meta name="description" content=".*?"\s*\/>/g, `<meta name="description" content="${escapeHtml(opts.description)}" />`);
  res = res.replace(/<link rel="canonical" href=".*?"\s*\/>/g, `<link rel="canonical" href="${escapeHtml(opts.canonical)}" />`);
  res = res.replace(/<meta property="og:title" content=".*?"\s*\/>/g, `<meta property="og:title" content="${escapeHtml(opts.title)}" />`);
  res = res.replace(/<meta property="og:description" content=".*?"\s*\/>/g, `<meta property="og:description" content="${escapeHtml(opts.description)}" />`);
  res = res.replace(/<meta property="og:url" content=".*?"\s*\/>/g, `<meta property="og:url" content="${escapeHtml(opts.canonical)}" />`);
  return res;
}

function fixPaths(html, depth) {
  const prefix = depth === 0 ? './' : '../'.repeat(depth);
  let res = html;
  res = res.replace(/href="styles\.css"/g, `href="${prefix}styles.css"`);
  res = res.replace(/src="icon\.svg"/g, `src="${prefix}icon.svg"`);
  res = res.replace(/href="manifest\.webmanifest"/g, `href="${prefix}manifest.webmanifest"`);
  res = res.replace(/href="index\.html"/g, `href="${prefix}index.html"`);
  res = res.replace(/href="books\.html"/g, `href="${prefix}books.html"`);
  res = res.replace(/src="shared\.js"/g, `src="${prefix}shared.js"`);
  return res;
}

async function main() {
  console.log('Fetching data from Firebase...');
  const res = await fetch(DB_URL);
  if (!res.ok) throw new Error('Failed to fetch data');
  const data = await res.json();
  
  ensureDir(DIST_DIR);
  
  const sitemapUrls = [];
  function addSitemap(url) {
    sitemapUrls.push(url);
  }

  // Load templates
  const tplIndex = fs.readFileSync('index.html', 'utf8');
  const tplSubjects = fs.readFileSync('subjects.html', 'utf8');
  const tplChapters = fs.readFileSync('chapters.html', 'utf8');
  const tplQuestions = fs.readFileSync('questions.html', 'utf8');
  const tplAnswer = fs.readFileSync('answer.html', 'utf8');

  // Parse classes
  const classes = [];
  Object.keys(data || {}).forEach(cId => {
    const cData = data[cId] || {};
    const cName = cData.name || cId;
    const cSlug = cData.slug || generateSlug(cName);
    const board = (cData.board || 'Classes').trim();
    const boardOrder = Number(cData.boardOrder == null ? 9999 : cData.boardOrder);
    const order = Number(cData.order == null ? 9999 : cData.order);
    
    const subjects = [];
    Object.keys(cData.subjects || {}).forEach(sId => {
      const sData = cData.subjects[sId] || {};
      const sName = sData.name || sId;
      const sSlug = sData.slug || generateSlug(sName);
      
      const chapters = [];
      Object.keys(sData.chapters || {}).forEach(chId => {
        const chData = sData.chapters[chId] || {};
        const chName = chData.name || chId;
        const chSlug = chData.slug || generateSlug(chName);
        
        const questions = [];
        Object.keys(chData.questions || {}).forEach(qId => {
          const qData = chData.questions[qId] || {};
          questions.push({
            id: qId,
            type: qData.type || '',
            question: qData.question || '',
            answer: qData.answer || ''
          });
        });
        
        chapters.push({
          id: chId, name: chName, slug: chSlug, questions, qcount: questions.length
        });
      });
      
      subjects.push({
        id: sId, name: sName, slug: sSlug, chapters, chapterCount: chapters.length
      });
    });
    
    classes.push({
      id: cId, name: cName, slug: cSlug, board, boardOrder, order, subjects, subjectCount: subjects.length
    });
  });

  // A) Generate index.html
  console.log('Generating index.html');
  {
    const depth = 0;
    const url = BASE_URL + '/';
    addSitemap(url);
    
    let html = tplIndex;
    html = fixPaths(html, depth);
    html = injectMeta(html, {
      title: 'Free Exercise Questions and Answers - Maharashtra Board Class 8, 9, 10, 11, 12 | QClasses',
      description: 'Free exercise questions and answers for Maharashtra Board SSC Class 10, HSC Class 12 and Class 8, 9, 11. One stop solution to score more in exams.',
      canonical: url
    });
    
    // board filters and list
    let groups = [];
    let byBoard = {};
    classes.forEach(c => {
      if (!byBoard[c.board]) {
        byBoard[c.board] = { title: c.board, order: c.boardOrder, items: [] };
        groups.push(byBoard[c.board]);
      }
      byBoard[c.board].items.push(c);
    });
    groups.sort((a, b) => a.order !== b.order ? a.order - b.order : String(a.title).localeCompare(String(b.title), undefined, { numeric: true }));
    
    let boardFiltersHtml = '<button class="filter-chip active" data-board="all">All</button>' +
      groups.map(g => `<button class="filter-chip" data-board="${escapeHtml(g.title)}">${escapeHtml(g.title)}</button>`).join('');
      
    if (groups.length <= 1) boardFiltersHtml = '';

    let contentHtml = groups.map(g => {
      g.items.sort((a, b) => a.order !== b.order ? a.order - b.order : String(a.name).localeCompare(String(b.name), undefined, { numeric: true }));
      return `<section class="board-section">` +
             `<div class="board-title">${escapeHtml(g.title)}</div>` +
             `<div class="list">` + g.items.map(c => {
               const countText = c.subjectCount ? (c.subjectCount === 1 ? '1 subject' : c.subjectCount + ' subjects') : '—';
               return `<a class="list-item" href="./subjects/${c.slug}/index.html">` +
                      svgIcon('class') +
                      `<span class="card-main"><span class="card-title">${escapeHtml(c.name)}</span>` +
                      `<span class="card-subtitle">${escapeHtml(g.title)}</span></span>` +
                      `<span class="count">${countText}</span>` +
                      `<span class="arrow">›</span></a>`;
             }).join('') + `</div></section>`;
    }).join('');

    html = html.replace(/<div class="board-filters"[^>]*>.*?<\/div>/s, `<div class="board-filters" id="boardFilters" style="${boardFiltersHtml ? 'display:flex;' : 'display:none;'}">${boardFiltersHtml}</div>`);
    html = html.replace(/<div id="content">.*?<\/div>\s*<\/div>/s, `<div id="content">${contentHtml}</div></div>`);
    
    fs.writeFileSync(path.join(DIST_DIR, 'index.html'), html);
  }

  // Generate subjects, chapters, questions, answers
  for (const c of classes) {
    // B) Generate subjects/[class-slug]/index.html
    console.log(`Generating subjects for ${c.slug}`);
    {
      const depth = 2; // subjects/class-slug/index.html
      const dir = path.join(DIST_DIR, 'subjects', c.slug);
      ensureDir(dir);
      const url = `${BASE_URL}/subjects/${c.slug}/`;
      addSitemap(url);
      
      let html = tplSubjects;
      html = fixPaths(html, depth);
      html = injectMeta(html, {
        title: `${c.name} - Exercise Questions and Answers | QClasses`,
        description: `Exercise questions and answers of ${c.name} SSC Maharashtra Board. Browse all subjects and chapters on QClasses.`,
        canonical: url
      });
      
      html = html.replace(/<h1 class="title" id="pageTitle">.*?<\/h1>/, `<h1 class="title" id="pageTitle">${escapeHtml(c.name)}</h1>`);
      html = html.replace(/<div class="breadcrumb" id="breadcrumb">.*?<\/div>/s, 
        `<div class="breadcrumb" id="breadcrumb">\n` +
        `      <a href="../../index.html">Classes</a>\n` +
        `      <span class="crumb-sep">›</span>\n` +
        `      <span class="current">${escapeHtml(c.name)}</span>\n` +
        `    </div>`);
        
      let subjectsHtml = `<div class="page-meta">${c.subjects.length} subject${c.subjects.length === 1 ? '' : 's'}</div>` +
        `<div class="list">` + c.subjects.map(s => {
          const countText = s.chapterCount ? (s.chapterCount === 1 ? '1 chapter' : s.chapterCount + ' chapters') : '—';
          return `<a class="list-item" href="../../chapters/${c.slug}/${s.slug}/index.html">` +
                 svgIcon('subject') +
                 `<span class="card-main"><span class="card-title">${escapeHtml(s.name)}</span></span>` +
                 `<span class="count">${countText}</span><span class="arrow">›</span></a>`;
        }).join('') + `</div>`;
        
      if (!c.subjects.length) subjectsHtml = '<div class="empty">No subjects available.</div>';
      
      html = html.replace(/<div id="content">.*?<\/div>\s*<\/div>\s*<footer/s, `<div id="content">${subjectsHtml}</div></div>\n<footer`);
      fs.writeFileSync(path.join(dir, 'index.html'), html);
    }
    
    for (const s of c.subjects) {
      // C) Generate chapters/[class-slug]/[subject-slug]/index.html
      console.log(`Generating chapters for ${c.slug} - ${s.slug}`);
      {
        const depth = 3; 
        const dir = path.join(DIST_DIR, 'chapters', c.slug, s.slug);
        ensureDir(dir);
        const url = `${BASE_URL}/chapters/${c.slug}/${s.slug}/`;
        addSitemap(url);
        
        let html = tplChapters;
        html = fixPaths(html, depth);
        html = injectMeta(html, {
          title: `${s.name} ${c.name} - Exercise Questions and Answers | QClasses`,
          description: `Exercise questions and answers of ${s.name} ${c.name} SSC Maharashtra Board. Browse all chapters on QClasses.`,
          canonical: url
        });
        
        html = html.replace(/<h1 class="title" id="pageTitle">.*?<\/h1>/, `<h1 class="title" id="pageTitle">${escapeHtml(s.name)}</h1>`);
        html = html.replace(/<div class="breadcrumb" id="breadcrumb">.*?<\/div>/s, 
          `<div class="breadcrumb" id="breadcrumb">\n` +
          `      <a href="../../../subjects/${c.slug}/index.html">${escapeHtml(c.name)}</a>\n` +
          `      <span class="crumb-sep">›</span>\n` +
          `      <span class="current">${escapeHtml(s.name)}</span>\n` +
          `    </div>`);
          
        let chaptersHtml = `<div class="page-meta">${s.chapters.length} chapter${s.chapters.length === 1 ? '' : 's'}</div>` +
          `<div class="list">` + s.chapters.map(ch => {
            const countText = ch.qcount === 0 ? '—' : (ch.qcount === 1 ? '1 question' : ch.qcount + ' questions');
            return `<a class="list-item" href="../../../questions/${c.slug}/${s.slug}/${ch.slug}/index.html">` +
                   svgIcon('chapter') +
                   `<span class="card-main"><span class="card-title">${escapeHtml(ch.name)}</span></span>` +
                   `<span class="count">${countText}</span><span class="arrow">›</span></a>`;
          }).join('') + `</div>`;
          
        if (!s.chapters.length) chaptersHtml = '<div class="empty">No chapters available.</div>';
        
        html = html.replace(/<div id="content">.*?<\/div>\s*<\/div>\s*<footer/s, `<div id="content">${chaptersHtml}</div></div>\n<footer`);
        fs.writeFileSync(path.join(dir, 'index.html'), html);
      }
      
      for (const ch of s.chapters) {
        // D) Generate questions/[class-slug]/[subject-slug]/[chapter-slug]/index.html
        {
          const depth = 4;
          const dir = path.join(DIST_DIR, 'questions', c.slug, s.slug, ch.slug);
          ensureDir(dir);
          const url = `${BASE_URL}/questions/${c.slug}/${s.slug}/${ch.slug}/`;
          addSitemap(url);
          
          let html = tplQuestions;
          html = fixPaths(html, depth);
          html = injectMeta(html, {
            title: `${ch.name} - ${s.name} ${c.name} Exercise Questions | QClasses`,
            description: `All exercise questions and answers for ${ch.name} - ${s.name} ${c.name} Maharashtra Board.`,
            canonical: url
          });
          
          html = html.replace(/<h1 class="title" id="pageTitle">.*?<\/h1>/, `<h1 class="title" id="pageTitle">${escapeHtml(ch.name)}</h1>`);
          html = html.replace(/<div class="breadcrumb" id="breadcrumb">.*?<\/div>/s, 
            `<div class="breadcrumb" id="breadcrumb">\n` +
            `      <a href="../../../../subjects/${c.slug}/index.html" class="crumb-desktop">${escapeHtml(c.name)}</a>\n` +
            `      <span class="crumb-sep crumb-desktop">›</span>\n` +
            `      <a href="../../../../chapters/${c.slug}/${s.slug}/index.html">${escapeHtml(s.name)}</a>\n` +
            `      <span class="crumb-sep">›</span>\n` +
            `      <span class="current">${escapeHtml(ch.name)}</span>\n` +
            `    </div>`);
            
          let questionsHtml = '';
          if (!ch.questions.length) {
            questionsHtml = '<div class="empty">No questions in this chapter yet.</div>';
          } else {
            const groupsMap = new Map();
            ch.questions.forEach(q => {
              const type = q.type || 'Other';
              if (!groupsMap.has(type)) groupsMap.set(type, []);
              groupsMap.get(type).push(q);
            });
            questionsHtml = `<div class="page-meta">${ch.questions.length} question${ch.questions.length === 1 ? '' : 's'}</div>`;
            groupsMap.forEach((qs, type) => {
              questionsHtml += `<div class="group"><div class="group-title">${escapeHtml(type)}</div><div class="group-list">`;
              questionsHtml += qs.map(q => {
                return `<a class="question-item" href="../../../../answer/${c.slug}/${s.slug}/${ch.slug}/${q.id}/index.html">` +
                       svgIcon('question') +
                       `<span class="card-main"><span class="card-title">${escapeHtml(q.question)}</span></span>` +
                       `<span class="arrow">›</span></a>`;
              }).join('');
              questionsHtml += `</div></div>`;
            });
          }
          html = html.replace(/<div id="content">.*?<\/div>\s*<\/div>\s*<footer/s, `<div id="content">${questionsHtml}</div></div>\n<footer`);
          fs.writeFileSync(path.join(dir, 'index.html'), html);
        }
        
        // E) Generate answer pages
        for (let idx = 0; idx < ch.questions.length; idx++) {
          const q = ch.questions[idx];
          const depth = 5;
          const dir = path.join(DIST_DIR, 'answer', c.slug, s.slug, ch.slug, q.id);
          ensureDir(dir);
          const url = `${BASE_URL}/answer/${c.slug}/${s.slug}/${ch.slug}/${q.id}/`;
          addSitemap(url);
          
          let html = tplAnswer;
          html = fixPaths(html, depth);
          
          let titlePrefix = (q.question || 'Question').substring(0, 60);
          if ((q.question || '').length > 60) titlePrefix += '...';
          
          html = injectMeta(html, {
            title: `${titlePrefix} - ${ch.name} ${s.name} ${c.name} | QClasses`,
            description: `Exercise question and answer for ${s.name} ${c.name} Maharashtra Board. ${q.question}`,
            canonical: url
          });
          
          let qHtml = `<div class="answer-type" id="type">${escapeHtml(q.type)}</div>` +
                      `<div class="answer-question" id="question">${escapeHtml(q.question)}</div>` +
                      `<div class="answer-image-list" id="imageWrap"></div>` +
                      `<div class="answer-text" id="text">${escapeHtml(q.answer).replace(/\n/g, '<br>')}</div>`;
                      
          // Header counter
          html = html.replace(/<div class="answer-counter" id="counter">.*?<\/div>/, 
            `<div class="answer-counter" id="counter">${idx + 1} of ${ch.questions.length}</div>`);
            
          html = html.replace(/<div class="skeleton-list" id="answerLoader">.*?<\/div>/s, qHtml);
          
          // Nav footer
          let prevBtn = '<button class="nav-btn disabled" id="prevBtn" disabled>‹ Prev</button>';
          if (idx > 0) {
            const prevQ = ch.questions[idx - 1];
            prevBtn = `<a class="nav-btn" id="prevBtn" href="../${prevQ.id}/index.html">‹ Prev</a>`;
          }
          
          let nextBtn = '<button class="nav-btn primary disabled" id="nextBtn" disabled>Next ›</button>';
          if (idx < ch.questions.length - 1) {
            const nextQ = ch.questions[idx + 1];
            nextBtn = `<a class="nav-btn primary" id="nextBtn" href="../${nextQ.id}/index.html">Next ›</a>`;
          }
          
          let navHtml = `\n    <a class="nav-btn" id="allQuestionsBtn" href="../../../../../questions/${c.slug}/${s.slug}/${ch.slug}/index.html">All Questions</a>\n` +
                        `    ${prevBtn}\n    ${nextBtn}\n  `;
          html = html.replace(/<div class="answer-footer">.*?<\/div>/s, `<div class="answer-footer">${navHtml}</div>`);
          
          // bottom back btn
          html = html.replace(/<a class="bottom-back-btn" id="bottomBackBtn" href="#" aria-label="Back">/s, `<a class="bottom-back-btn" id="bottomBackBtn" href="../../../../../questions/${c.slug}/${s.slug}/${ch.slug}/index.html" aria-label="Back">`);
          
          fs.writeFileSync(path.join(dir, 'index.html'), html);
        }
      }
    }
  }

  // Generate Sitemap
  console.log('Generating sitemap');
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls.map(u => `  <url><loc>${u}</loc></url>`).join('\n')}
</urlset>`;
  fs.writeFileSync(path.join(DIST_DIR, 'sitemap.xml'), sitemapXml);
  
  console.log('Generating _redirects');
  fs.writeFileSync(path.join(DIST_DIR, '_redirects'), `/subjects.html  /subjects/:class  301\n/chapters.html  /chapters/:class/:subject  301\n`);

  console.log('Copying static assets');
  fs.copyFileSync('styles.css', path.join(DIST_DIR, 'styles.css'));
  fs.copyFileSync('shared.js', path.join(DIST_DIR, 'shared.js'));
  fs.copyFileSync('icon.svg', path.join(DIST_DIR, 'icon.svg'));
  fs.copyFileSync('manifest.webmanifest', path.join(DIST_DIR, 'manifest.webmanifest'));
  fs.copyFileSync('icon-maskable-512.png', path.join(DIST_DIR, 'icon-maskable-512.png'));
  
  // also need to copy books.html directly, or we can just make books.html part of the root dist
  const tplBooks = fs.readFileSync('books.html', 'utf8');
  fs.writeFileSync(path.join(DIST_DIR, 'books.html'), tplBooks);

  console.log('Done!');
}

main().catch(console.error);
