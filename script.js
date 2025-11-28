// script.js - スーパー品出しSPA
const CATEGORY_ORDER = ['水', 'お茶', 'ジュース', '炭酸', '大型飲料', 'コーヒー', 'その他', 'キッチン', 'ティッシュ', 'トイレットペーパー'];
const TAB_FILES = { drinks: 'drinks.csv', paper: 'paper.csv' };
let currentTab = 'drinks';
let products = [];
let tasks = [];
let outOfStockItems = JSON.parse(localStorage.getItem('outOfStockItems') || '[]');
let outOfStockCounts = JSON.parse(localStorage.getItem('outOfStockCounts') || '{}');
let outOfStockRestoreStatus = JSON.parse(localStorage.getItem('outOfStockRestoreStatus') || '{}');
window.searchKeyword = '';

// --- CSV Utility ---
function parseCSV(text) {
  // Robust CSV parser that handles quoted fields containing commas and double-quotes
  const lines = text.trim().split(/\r?\n/);
  const parseLine = (line) => {
    const cols = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        // handle escaped quotes ""
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (ch === ',' && !inQuotes) {
        cols.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    cols.push(cur);
    return cols;
  };
  const headers = parseLine(lines[0]);
  return lines.slice(1).map(line => {
    if (!line.trim()) return null;
    const cols = parseLine(line);
    const obj = {};
    headers.forEach((h, i) => {
      let v = cols[i] || '';
      // remove surrounding quotes and unescape double quotes
      if (v.length >= 2 && v[0] === '"' && v[v.length - 1] === '"') {
        v = v.slice(1, -1).replace(/""/g, '"');
      }
      obj[h] = v;
    });
    obj.boxCount = Number(obj.boxCount) || 0;
    try { obj.tasks = obj.tasks ? JSON.parse(obj.tasks) : []; } catch (e) { obj.tasks = []; }
    obj.order = Number(obj.order) || 0;
    return obj;
  }).filter(Boolean);
}

// --- Data Load ---
async function loadProducts(tab) {
  const res = await fetch(TAB_FILES[tab]);
  const text = await res.text();
  products = parseCSV(text).sort((a, b) => a.order - b.order);
  renderProducts();
  renderTasks();
}

// --- Product List ---
let taskCounts = {};
function updateTaskCounts() {
  taskCounts = {};
  tasks.forEach(t => {
    if (!taskCounts[t.id]) taskCounts[t.id] = 0;
    taskCounts[t.id]++;
  });
}

function renderProducts() {
  updateTaskCounts();
  const list = document.getElementById('product-list');
  list.innerHTML = '';
  // locationごとにグループ化
  const grouped = {};
  const locationOrder = [];
  let customPaperOrder = ["キッチン用品", "レジ前", "トイレ用品"];
  let isPaperTab = currentTab === 'paper';
  products.forEach(prod => {
    if (!grouped[prod.location]) {
      grouped[prod.location] = [];
      locationOrder.push(prod.location);
    }
    grouped[prod.location].push(prod);
  });
  let orderList = locationOrder;
  if (isPaperTab) {
    orderList = customPaperOrder.filter(loc => locationOrder.includes(loc)).concat(locationOrder.filter(loc => !customPaperOrder.includes(loc)));
  }
  orderList.forEach(location => {
    const heading = document.createElement('h2');
    heading.className = 'location-heading';
    heading.textContent = location;
    list.appendChild(heading);
    const gridDiv = document.createElement('div');
    gridDiv.className = 'product-grid';
    grouped[location].forEach(prod => {
      if (window.searchKeyword && !prod.name.toLowerCase().includes(window.searchKeyword)) return;
      const card = document.createElement('div');
      card.className = 'product-card';
      card.setAttribute('data-id', prod.id);
      if (outOfStockItems.includes(prod.id)) {
        card.classList.add('out-of-stock');
      }
      // 数量表示エリア
      let count = taskCounts[prod.id] || 0;
      let boxHtml = '';
      if (currentTab === 'drinks') {
        boxHtml = `<div class="product-box">追加数: ${count}</div>`;
      } else {
        // paper.csvのCount列
        let possible = Number(prod.Count) || 0;
        boxHtml = `<div class="product-box">${count}/${possible}</div>`;
      }
      card.innerHTML = `
        <img src="${prod.imageUrl}" alt="${prod.name}">
        <div class="product-name">${prod.name}</div>
        ${boxHtml}
      `;
      // 長押しGoogle検索機能
      let longPressTimer = null;
      let isLongPress = false;
  const LONG_PRESS_DURATION = 2000;
      const imgElem = card.querySelector('img');
      imgElem.addEventListener('mousedown', (e) => {
        if (outOfStockItems.includes(prod.id)) return;
        isLongPress = false;
        longPressTimer = setTimeout(() => {
          isLongPress = true;
          const searchUrl = 'https://www.google.com/search?q=' + encodeURIComponent(prod.name);
          window.open(searchUrl, '_blank');
        }, LONG_PRESS_DURATION);
      });
      imgElem.addEventListener('mouseup', () => {
        clearTimeout(longPressTimer);
      });
      imgElem.addEventListener('mouseleave', () => {
        clearTimeout(longPressTimer);
      });
      imgElem.addEventListener('touchstart', (e) => {
        if (outOfStockItems.includes(prod.id)) return;
        isLongPress = false;
        longPressTimer = setTimeout(() => {
          isLongPress = true;
          const searchUrl = 'https://www.google.com/search?q=' + encodeURIComponent(prod.name);
          window.open(searchUrl, '_blank');
        }, LONG_PRESS_DURATION);
      });
      imgElem.addEventListener('touchend', () => {
        clearTimeout(longPressTimer);
      });
      // 通常タップ（短押し）
      card.onclick = () => {
        if (outOfStockItems.includes(prod.id)) return;
        if (isLongPress) {
          isLongPress = false;
          return;
        }
        addTask(prod);
        card.classList.add('touch-highlight');
        setTimeout(() => card.classList.remove('touch-highlight'), 350);
      };
      gridDiv.appendChild(card);
    });
    list.appendChild(gridDiv);
  });
}

// タスク追加
function addTask(product) {
  tasks.push({ ...product, status: 'new', taskUid: Date.now() + Math.random() });
  if (!taskCounts[product.id]) taskCounts[product.id] = 0;
  taskCounts[product.id]++;
  saveTasks();
  renderTasks();
  renderProducts(); // 追加数即時反映
}

// タスク削除
function deleteTask(taskUid) {
  const idx = tasks.findIndex(t => t.taskUid === taskUid);
  if (idx !== -1) {
    const id = tasks[idx].id;
    tasks.splice(idx, 1);
    if (taskCounts[id]) {
      taskCounts[id]--;
      if (taskCounts[id] <= 0) delete taskCounts[id];
    }
    saveTasks();
    renderTasks();
    renderProducts(); // 追加数即時反映
  }
}

// --- Task List ---
function renderTasks() {
  const area = document.getElementById('task-list');
  area.innerHTML = '';

  // 分類：通常、新規(=new), 未運搬(not-carried), 運搬済(carried)
  const normal = [];
  const notCarried = [];
  const carried = [];

  tasks.forEach(t => {
    // 紙タブでカテゴリフィルタがある場合は適用
    if (currentTab === 'paper' && window.paperCategoryFilter && t.category !== window.paperCategoryFilter) return;
    // 検索フィルタ（紙タブでは検索を無効）
    if (currentTab !== 'paper' && window.searchKeyword && !t.name.toLowerCase().includes(window.searchKeyword)) return;
    if (t.status === 'carried') carried.push(t);
    else if (t.status === 'not-carried') notCarried.push(t);
    else normal.push(t);
  });

  // 表示順定義
  const drinkOrder = ['水', 'お茶', 'ジュース', '炭酸', '大型飲料', 'コーヒー', 'その他'];
  const paperOrder = ['キッチン', 'ティッシュ', 'トイレットペーパー'];

  if (currentTab === 'drinks') {
    // 通常タスク（カテゴリ順）
    drinkOrder.forEach(cat => {
      const items = normal.filter(t => t.category === cat);
      if (!items.length) return;
      const catDiv = document.createElement('div');
      catDiv.className = 'task-category';
      catDiv.innerHTML = `<div class="task-category-title">${cat}</div>`;
      items.forEach(task => {
        const item = document.createElement('div');
        item.className = 'task-item';
        item.innerHTML = `
          <div class="task-item-content">
            <img class="task-img" src="${task.imageUrl}" alt="img">
            <div class="task-name">${task.name}</div>
          </div>
          <div class="task-buttons">
            <button class="carried-btn">運搬済</button>
            <button class="not-carried-btn">未運搬</button>
            <button class="delete-btn">削除</button>
          </div>`;
        item.querySelector('.carried-btn').onclick = () => { task.status = 'carried'; saveTasks(); renderTasks(); };
        item.querySelector('.not-carried-btn').onclick = () => { task.status = 'not-carried'; saveTasks(); renderTasks(); };
        item.querySelector('.delete-btn').onclick = () => { tasks = tasks.filter(t => t.taskUid !== task.taskUid); saveTasks(); renderTasks(); };
        catDiv.appendChild(item);
      });
      area.appendChild(catDiv);
    });

    // 未運搬エリア（通常タスクの下、在庫無の上）
    const hasNot = notCarried.length > 0;
    if (hasNot) {
      const notDiv = document.createElement('div');
      notDiv.className = 'out-stock-list';
      notDiv.innerHTML = '<div class="out-stock-title">未運搬商品</div>';
      drinkOrder.forEach(cat => {
        const items = notCarried.filter(t => t.category === cat);
        if (!items.length) return;
        items.forEach(task => {
          // 同じ見た目・UIにするため通常タスクと同様の構成にする
          const item = document.createElement('div');
          item.className = 'task-item';
          item.innerHTML = `
            <div class="task-item-content">
              <img class="task-img" src="${task.imageUrl}" alt="img">
              <div class="task-name">${task.name}</div>
            </div>
            <div class="task-buttons">
              <button class="carried-btn">運搬済</button>
              <button class="not-carried-btn">${task.status === 'not-carried' ? '在庫無' : '未運搬'}</button>
              <button class="delete-btn">削除</button>
            </div>`;
          // 各ボタンの挙動を通常タスクと同じにする
          item.querySelector('.carried-btn').onclick = () => { task.status = 'carried'; saveTasks(); renderTasks(); };
          item.querySelector('.not-carried-btn').onclick = () => {
            // 在庫無に移す
            if (!outOfStockItems.includes(task.id)) {
              outOfStockItems.push(task.id);
              const sameTasks = tasks.filter(t => t.id === task.id);
              outOfStockCounts[task.id] = sameTasks.length;
              outOfStockRestoreStatus[task.id] = sameTasks.map(t => t.status);
              localStorage.setItem('outOfStockItems', JSON.stringify(outOfStockItems));
              localStorage.setItem('outOfStockCounts', JSON.stringify(outOfStockCounts));
              localStorage.setItem('outOfStockRestoreStatus', JSON.stringify(outOfStockRestoreStatus));
            }
            renderProducts();
            tasks = tasks.filter(t => t.id !== task.id);
            saveTasks();
            renderTasks();
          };
          item.querySelector('.delete-btn').onclick = () => { tasks = tasks.filter(t2 => t2.taskUid !== task.taskUid); saveTasks(); renderTasks(); };
          notDiv.appendChild(item);
        });
      });
      area.appendChild(notDiv);
    }
  }

  // 在庫無（ドリンクのみ表示）
  if (currentTab === 'drinks') {
    const uniqueOutStock = Array.from(new Set(outOfStockItems));
    if (uniqueOutStock.length > 0) {
      const outDiv = document.createElement('div');
      outDiv.className = 'out-stock-list';
      outDiv.innerHTML = '<div class="out-stock-title">在庫無商品</div>';
      uniqueOutStock.forEach(id => {
        const prod = products.find(p => p.id === id);
        if (!prod) return;
        const item = document.createElement('div');
        item.className = 'out-stock-item';
        item.innerHTML = `
          <img class="task-img" src="${prod.imageUrl}" alt="img">
          <span class="task-name">${prod.name}</span>`;
        const restoreBtn = document.createElement('button');
        restoreBtn.className = 'restore-btn';
        restoreBtn.textContent = 'タスクに戻す';
        restoreBtn.onclick = () => {
          outOfStockItems = outOfStockItems.filter(x => x !== id);
          localStorage.setItem('outOfStockItems', JSON.stringify(outOfStockItems));
          const restoreCount = outOfStockCounts[id] || 1;
          const restoreStatusArr = outOfStockRestoreStatus[id] || [];
          delete outOfStockCounts[id]; delete outOfStockRestoreStatus[id];
          localStorage.setItem('outOfStockCounts', JSON.stringify(outOfStockCounts));
          localStorage.setItem('outOfStockRestoreStatus', JSON.stringify(outOfStockRestoreStatus));
          for (let i = 0; i < restoreCount; i++) {
            const prodObj = products.find(p => p.id === id);
            if (prodObj) {
              const status = restoreStatusArr[i] || 'new';
              tasks.push({ ...prodObj, status, taskUid: Date.now() + Math.random() });
            }
          }
          saveTasks(); renderTasks(); renderProducts();
        };
        item.appendChild(restoreBtn);
        outDiv.appendChild(item);
      });
      area.appendChild(outDiv);
    }
  }

  // 紙タブの特別表示：集約表示（同IDを1行にまとめ、カウント表示）
  if (currentTab === 'paper') {
    // 集約対象（フィルタ済み tasks の中の ids）
    const ids = Array.from(new Set(tasks.map(t => t.id)));
    // カテゴリ選択がある場合、さらに絞る
    const filteredIds = ids.filter(id => {
      const prod = products.find(p => p.id === id);
      if (!prod) return false;
      if (window.paperCategoryFilter && prod.category !== window.paperCategoryFilter) return false;
      return true;
    });
    filteredIds.forEach(id => {
      const prod = products.find(p => p.id === id);
      if (!prod) return;
      const totalAdded = taskCounts[id] || tasks.filter(t => t.id === id).length;
      const carriedCount = tasks.filter(t => t.id === id && t.status === 'carried').length;
      // すでに全数運搬済ならこの行を表示せず、運搬済欄へ移動させる
      if (carriedCount >= totalAdded && totalAdded > 0) return;
      const item = document.createElement('div');
      item.className = 'task-item';
      item.innerHTML = `
        <div class="task-item-content">
          <img class="task-img" src="${prod.imageUrl}" alt="img">
          <div class="task-name">${prod.name}</div>
        </div>`;
      // ボタン：運搬済・削除のみ
      const btnWrap = document.createElement('div'); btnWrap.className = 'task-buttons';
      const carriedBtn = document.createElement('button'); carriedBtn.className = 'carried-btn'; carriedBtn.textContent = '運搬済';
      carriedBtn.onclick = () => {
        // 一つだけ未運搬/newのタスクを運搬済にする（カウントアップ）
        const target = tasks.find(t => t.id === id && t.status !== 'carried');
        if (target) {
          target.status = 'carried';
          saveTasks();
          renderTasks();
        }
      };
      const delBtn = document.createElement('button'); delBtn.className = 'delete-btn'; delBtn.textContent = '削除';
      delBtn.onclick = () => {
        tasks = tasks.filter(t => t.id !== id);
        taskCounts[id] = 0;
        saveTasks(); renderTasks(); renderProducts();
      };
  btnWrap.appendChild(carriedBtn);
  btnWrap.appendChild(delBtn);
      item.appendChild(btnWrap);
      // カウント表示（削除ボタンの下）
      const countEl = document.createElement('div');
      countEl.style.textAlign = 'center';
      countEl.style.fontSize = '0.95rem';
      countEl.style.color = '#888';
      countEl.textContent = `${carriedCount}/${totalAdded}`;
      item.appendChild(countEl);
      area.appendChild(item);
    });
    // 紙タブでは在庫無リストは表示しない
    // NOTE: ここで return してしまうと下の「運搬済一覧」が描画されないため、
    // 紙タブでも運搬済をページ下部に表示するために return を除去する。
  }

  // --- 紙タブ：未運搬商品をカテゴリごとに表示 ---
  if (currentTab === 'paper') {
    const hasNotPaper = notCarried.length > 0;
    if (hasNotPaper) {
      const notDiv = document.createElement('div');
      notDiv.className = 'out-stock-list';
      notDiv.innerHTML = '<div class="out-stock-title">未運搬商品</div>';
      paperOrder.forEach(cat => {
        const items = notCarried.filter(t => t.category === cat);
        if (!items.length) return;
        items.forEach(task => {
          const item = document.createElement('div');
          item.className = 'task-item';
          item.innerHTML = `
            <div class="task-item-content">
              <img class="task-img" src="${task.imageUrl}" alt="img">
              <div class="task-name">${task.name}</div>
            </div>
            <div class="task-buttons">
              <button class="carried-btn">運搬済</button>
              <button class="not-carried-btn">${task.status === 'not-carried' ? '在庫無' : '未運搬'}</button>
              <button class="delete-btn">削除</button>
            </div>`;
          item.querySelector('.carried-btn').onclick = () => { task.status = 'carried'; saveTasks(); renderTasks(); };
          item.querySelector('.not-carried-btn').onclick = () => {
            if (!outOfStockItems.includes(task.id)) {
              outOfStockItems.push(task.id);
              const sameTasks = tasks.filter(t => t.id === task.id);
              outOfStockCounts[task.id] = sameTasks.length;
              outOfStockRestoreStatus[task.id] = sameTasks.map(t => t.status);
              localStorage.setItem('outOfStockItems', JSON.stringify(outOfStockItems));
              localStorage.setItem('outOfStockCounts', JSON.stringify(outOfStockCounts));
              localStorage.setItem('outOfStockRestoreStatus', JSON.stringify(outOfStockRestoreStatus));
            }
            renderProducts();
            tasks = tasks.filter(t => t.id !== task.id);
            saveTasks();
            renderTasks();
          };
          item.querySelector('.delete-btn').onclick = () => { tasks = tasks.filter(t2 => t2.taskUid !== task.taskUid); saveTasks(); renderTasks(); };
          notDiv.appendChild(item);
        });
      });
      area.appendChild(notDiv);
    }
  }

  // 運搬済タスク一覧（カテゴリ順）
  if (carried.length > 0) {
    const carriedDiv = document.createElement('div');
    carriedDiv.className = 'out-stock-list';
    carriedDiv.innerHTML = '<div class="out-stock-title">運搬済商品</div>';
    const grouped = {};
    carried.forEach(t => { if (!grouped[t.category]) grouped[t.category] = []; grouped[t.category].push(t); });
    const showCats = currentTab === 'drinks' ? drinkOrder : paperOrder;
    showCats.forEach(cat => {
      if (!grouped[cat]) return;
      grouped[cat].forEach(task => {
        const item = document.createElement('div');
        item.className = 'out-stock-item carried';
        item.innerHTML = `
          <img class="task-img" src="${task.imageUrl}" alt="img">
          <span class="task-name">${task.name}</span>`;
        const delBtn = document.createElement('button'); delBtn.className = 'delete-btn'; delBtn.textContent = '削除';
        delBtn.onclick = () => { tasks = tasks.filter(t2 => t2.taskUid !== task.taskUid); saveTasks(); renderTasks(); };
        const notBtn = document.createElement('button'); notBtn.className = 'not-carried-btn'; notBtn.textContent = '未運搬';
        notBtn.onclick = () => { task.status = 'new'; saveTasks(); renderTasks(); };
        const btns = document.createElement('div'); btns.className = 'carried-task-buttons'; btns.appendChild(delBtn); btns.appendChild(notBtn);
        item.appendChild(btns);
        carriedDiv.appendChild(item);
      });
    });
    area.appendChild(carriedDiv);
  }
}

// --- タスク保存・リセット ---
function saveTasks() {
  localStorage.setItem('tasks', JSON.stringify(tasks));
}
function loadTasks() {
  const t = localStorage.getItem('tasks');
  tasks = t ? JSON.parse(t) : [];
}

// --- タブ切り替え ---
function setTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById(`tab-${tab}`).classList.add('active');
  loadProducts(tab);
}

// --- 初期化 ---
document.addEventListener('DOMContentLoaded', () => {
  // ダーク/ライトモード初期化
  const themeToggle = document.getElementById('theme-toggle');
  const body = document.body;
  // localStorageから取得
  const savedTheme = localStorage.getItem('themeMode');
  if (savedTheme === 'dark') {
    body.classList.add('dark-mode');
    themeToggle.checked = true;
  } else {
    body.classList.remove('dark-mode');
    themeToggle.checked = false;
  }
  // トグル操作
  if (themeToggle) {
    themeToggle.addEventListener('change', (e) => {
      if (themeToggle.checked) {
        body.classList.add('dark-mode');
        localStorage.setItem('themeMode', 'dark');
      } else {
        body.classList.remove('dark-mode');
        localStorage.setItem('themeMode', 'light');
      }
    });
  }
  // タスクタブ表示制御
  document.getElementById('subtab-tasks').onclick = () => {
    document.getElementById('product-list').style.display = 'none';
    document.querySelector('.task-tabs').style.display = '';
    document.getElementById('task-list').style.display = '';
    document.getElementById('subtab-products').classList.remove('active');
    document.getElementById('subtab-tasks').classList.add('active');
    // 紙タブ時は検索を非表示にしてカテゴリボタンを表示（初期は全て）
    const searchBox = document.getElementById('search-box');
    const paperBtns = document.getElementById('paper-cat-buttons');
    if (currentTab === 'paper') {
      if (searchBox) searchBox.style.display = 'none';
      if (paperBtns) paperBtns.style.display = '';
      window.paperCategoryFilter = null; // 初期は全て
    } else {
      if (searchBox) searchBox.style.display = '';
      if (paperBtns) paperBtns.style.display = 'none';
    }
  };
  document.getElementById('subtab-products').onclick = () => {
    document.getElementById('product-list').style.display = '';
    document.querySelector('.task-tabs').style.display = 'none';
    document.getElementById('task-list').style.display = 'none';
    document.getElementById('subtab-products').classList.add('active');
    document.getElementById('subtab-tasks').classList.remove('active');
  };
  // 紙カテゴリボタン群のクリックイベント
  const paperBtns = document.querySelectorAll('.paper-cat-btn');
  if (paperBtns) {
    paperBtns.forEach(b => b.addEventListener('click', (e) => {
      const cat = e.currentTarget.getAttribute('data-cat');
      window.paperCategoryFilter = cat === 'all' ? null : cat;
      // 見た目のactive付け
      paperBtns.forEach(x => x.classList.remove('active'));
      e.currentTarget.classList.add('active');
      renderTasks();
    }));
  }
  // 設定ボタン
  document.getElementById('settings-btn').onclick = () => {
    document.getElementById('settings-modal').style.display = 'flex';
  };
  document.getElementById('close-settings').onclick = () => {
    document.getElementById('settings-modal').style.display = 'none';
  };
  // チャットサポートボタン
  document.getElementById('chatbot-btn').onclick = () => {
    // 設定モーダルを閉じる
    document.getElementById('settings-modal').style.display = 'none';
    // 他のコンテンツを非表示
    document.getElementById('product-list').style.display = 'none';
    document.getElementById('task-list').style.display = 'none';
    // チャットボットエリアを表示
    document.getElementById('chatbot-area').style.display = '';
    // タブとサブタブのactiveクラスをリセット
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.subtab').forEach(st => st.classList.remove('active'));
  };
  // チャットボット閉じるボタン
  document.getElementById('close-chatbot-btn').onclick = () => {
    // チャットボットエリアを非表示
    document.getElementById('chatbot-area').style.display = 'none';
    // 商品一覧を表示
    document.getElementById('product-list').style.display = '';
    // タスク一覧は非表示のまま
    document.getElementById('task-list').style.display = 'none';
    // サブタブの商品タブをアクティブに
    document.getElementById('subtab-products').classList.add('active');
    document.getElementById('subtab-tasks').classList.remove('active');
    // メインタブ（飲料）をアクティブに戻す
    document.getElementById('tab-drinks').classList.add('active');
  };
  document.getElementById('reset-btn').onclick = () => {
  localStorage.removeItem('tasks');
  localStorage.removeItem('outOfStockItems');
    tasks = [];
    outOfStockItems = [];
    renderProducts();
    renderTasks();
    document.getElementById('settings-modal').style.display = 'none';
  };
  // タブ
  document.getElementById('tab-drinks').onclick = () => setTab('drinks');
  document.getElementById('tab-paper').onclick = () => setTab('paper');
  // サブタブ
  document.getElementById('subtab-products').onclick = () => {
    document.getElementById('product-list').style.display = '';
    document.getElementById('task-list').style.display = 'none';
    document.getElementById('subtab-products').classList.add('active');
    document.getElementById('subtab-tasks').classList.remove('active');
  };
  document.getElementById('subtab-tasks').onclick = () => {
    document.getElementById('product-list').style.display = 'none';
    document.getElementById('task-list').style.display = '';
    document.getElementById('subtab-products').classList.remove('active');
    document.getElementById('subtab-tasks').classList.add('active');
  };
  // 検索ボックス
  const searchBox = document.getElementById('search-box');
  if (searchBox) {
    searchBox.addEventListener('input', e => {
      window.searchKeyword = e.target.value.trim().toLowerCase();
      renderProducts();
      renderTasks();
    });
  }
  // データ
  loadProducts(currentTab);
  loadTasks();
  renderTasks();
});

// ページトップへ戻るボタン
window.addEventListener('scroll', () => {
  const btn = document.getElementById('scrollTopBtn');
  if (btn) {
    if (window.scrollY > 200) {
      btn.classList.add('show');
      btn.classList.remove('hide');
    } else {
      btn.classList.remove('show');
      btn.classList.add('hide');
    }
  }
  // 最下部スクロール判定
  const logo = document.getElementById('kutsuzawa-logo');
  if (logo) {
    const scrollBottom = window.innerHeight + window.scrollY;
    const docHeight = document.documentElement.scrollHeight;
    if (docHeight - scrollBottom < 10) {
      logo.classList.add('show');
    } else {
      logo.classList.remove('show');
    }
  }
});
document.getElementById('scrollTopBtn').onclick = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
};
