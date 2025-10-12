// script.js - スーパー品出しSPA
const CATEGORY_ORDER = ['お茶', '水', 'ジュース', '炭酸', '大型飲料', 'コーヒー', 'その他', 'キッチン', 'ティッシュ', 'トイレットペーパー'];
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
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    const cols = line.split(',');
    const obj = {};
    headers.forEach((h, i) => obj[h] = cols[i] || '');
    obj.boxCount = Number(obj.boxCount) || 0;
    obj.tasks = obj.tasks ? JSON.parse(obj.tasks) : [];
    obj.order = Number(obj.order) || 0;
    return obj;
  });
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
  // グループ化
  const grouped = {};
  tasks.forEach(t => {
    // 検索フィルタ
    if (window.searchKeyword && !t.name.toLowerCase().includes(window.searchKeyword)) return;
    // 運搬済はカテゴリ表示から除外
    if (t.status === 'carried') return;
    const cat = t.category;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(t);
  });
  // タブごとに表示
  const showCats = currentTab === 'drinks'
    ? ['お茶', '水', 'ジュース', '炭酸', '大型飲料', 'コーヒー', 'その他']
    : ['キッチン', 'ティッシュ', 'トイレットペーパー'];
  showCats.forEach(cat => {
    if (!grouped[cat]) return;
    const catDiv = document.createElement('div');
    catDiv.className = 'task-category';
    catDiv.innerHTML = `<div class="task-category-title">${cat}</div>`;
    grouped[cat].forEach((task, idx) => {
      const item = document.createElement('div');
      item.className = 'task-item';
      if (task.status === 'carried') item.classList.add('carried');
      if (task.status === 'not-carried') item.classList.add('not-carried');
      item.innerHTML = `
        <div class="task-item-content">
          <img class="task-img" src="${task.imageUrl}" alt="img">
          <div class="task-name">${task.name}</div>
        </div>
        <div class="task-buttons">
          <button class="carried-btn">運搬済</button>
          <button class="not-carried-btn">${task.status === 'not-carried' ? '在庫無' : '未運搬'}</button>
          <button class="delete-btn">削除</button>
        </div>
      `;
      item.querySelector('.carried-btn').onclick = () => {
        task.status = 'carried';
        grouped[cat].push(grouped[cat].splice(idx,1)[0]);
        saveTasks();
        renderTasks();
      };
      // 未運搬→在庫無
      const notBtn = item.querySelector('.not-carried-btn');
      if (task.status === 'not-carried') {
        notBtn.classList.add('mark-out-of-stock');
      }
      notBtn.onclick = () => {
        if (notBtn.classList.contains('mark-out-of-stock')) {
          // 在庫無ボタン
          if (!outOfStockItems.includes(task.id)) {
            outOfStockItems.push(task.id);
            // 個数記録
            const sameTasks = tasks.filter(t => t.id === task.id);
            outOfStockCounts[task.id] = sameTasks.length;
            // 運搬済/未運搬状態も記録
            outOfStockRestoreStatus[task.id] = sameTasks.map(t => t.status);
            localStorage.setItem('outOfStockItems', JSON.stringify(outOfStockItems));
            localStorage.setItem('outOfStockCounts', JSON.stringify(outOfStockCounts));
            localStorage.setItem('outOfStockRestoreStatus', JSON.stringify(outOfStockRestoreStatus));
          }
          renderProducts();
          // 同IDタスク一括削除
          tasks = tasks.filter(t => t.id !== task.id);
          saveTasks();
          renderTasks();
        } else {
          task.status = 'not-carried';
          notBtn.textContent = '在庫無';
          notBtn.classList.add('mark-out-of-stock');
          grouped[cat].push(grouped[cat].splice(idx,1)[0]);
          saveTasks();
          renderTasks();
        }
      };
      item.querySelector('.delete-btn').onclick = () => {
        tasks = tasks.filter(t => t.taskUid !== task.taskUid);
        saveTasks();
        renderTasks();
      };
      catDiv.appendChild(item);
    });
    area.appendChild(catDiv);
  });
  // 在庫無商品一覧（重複なし）
  const uniqueOutStock = Array.from(new Set(outOfStockItems));
  if (uniqueOutStock.length > 0) {
    const outDiv = document.createElement('div');
    outDiv.className = 'out-stock-list';
    outDiv.innerHTML = '<div class="out-stock-title">在庫無商品</div>';
    uniqueOutStock.forEach(id => {
      const prod = products.find(p => p.id === id);
      if (prod) {
        const item = document.createElement('div');
        item.className = 'out-stock-item';
        item.innerHTML = `
          <img class="task-img" src="${prod.imageUrl}" alt="img">
          <span class="task-name">${prod.name}</span>
        `;
        // タスクに戻すボタン
        const restoreBtn = document.createElement('button');
        restoreBtn.className = 'restore-btn';
        restoreBtn.textContent = 'タスクに戻す';
        restoreBtn.onclick = () => {
          // 在庫無解除
          outOfStockItems = outOfStockItems.filter(x => x !== id);
          localStorage.setItem('outOfStockItems', JSON.stringify(outOfStockItems));
          // 個数取得
          const restoreCount = outOfStockCounts[id] || 1;
          // 運搬済/未運搬状態取得
          const restoreStatusArr = outOfStockRestoreStatus[id] || [];
          delete outOfStockCounts[id];
          delete outOfStockRestoreStatus[id];
          localStorage.setItem('outOfStockCounts', JSON.stringify(outOfStockCounts));
          localStorage.setItem('outOfStockRestoreStatus', JSON.stringify(outOfStockRestoreStatus));
          renderProducts();
          // タスク復元
          for (let i = 0; i < restoreCount; i++) {
            const prodObj = products.find(p => p.id === id);
            if (prodObj) {
              const status = restoreStatusArr[i] || 'new';
              tasks.push({ ...prodObj, status, taskUid: Date.now() + Math.random() });
            }
          }
          saveTasks();
          renderTasks();
        };
        item.appendChild(restoreBtn);
        outDiv.appendChild(item);
      }
    });
    area.appendChild(outDiv);
  }

  // 運搬済タスク一覧（重複なし）
  const carriedTasks = tasks.filter(t => t.status === 'carried');
  if (carriedTasks.length > 0) {
    const carriedDiv = document.createElement('div');
    carriedDiv.className = 'out-stock-list';
    carriedDiv.innerHTML = '<div class="out-stock-title">運搬済商品</div>';
    // category順でグループ化
    const grouped = {};
    carriedTasks.forEach(t => {
      if (!grouped[t.category]) grouped[t.category] = [];
      grouped[t.category].push(t);
    });
    const showCats = currentTab === 'drinks'
      ? ['お茶', '水', 'ジュース', '炭酸', '大型飲料', 'コーヒー', 'その他']
      : ['キッチン', 'ティッシュ', 'トイレットペーパー'];
    showCats.forEach(cat => {
      if (!grouped[cat]) return;
      grouped[cat].forEach(task => {
        const item = document.createElement('div');
        item.className = 'out-stock-item carried';
        item.innerHTML = `
          <img class="task-img" src="${task.imageUrl}" alt="img">
          <span class="task-name">${task.name}</span>
        `;
        // 削除ボタン
        const delBtn = document.createElement('button');
        delBtn.className = 'delete-btn';
        delBtn.textContent = '削除';
        delBtn.onclick = () => {
          tasks = tasks.filter(t2 => t2.taskUid !== task.taskUid);
          saveTasks();
          renderTasks();
        };
        // 未運搬ボタン
        const notBtn = document.createElement('button');
        notBtn.className = 'not-carried-btn';
        notBtn.textContent = '未運搬';
        notBtn.onclick = () => {
          task.status = 'new';
          saveTasks();
          renderTasks();
        };
        const btns = document.createElement('div');
        btns.className = 'carried-task-buttons';
        btns.appendChild(delBtn);
        btns.appendChild(notBtn);
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
  // タスクリセット(火木土)ボタン
  document.getElementById('task-reset-btn').onclick = () => {
    // 在庫無商品以外のタスクのみ削除
    tasks = tasks.filter(t => outOfStockItems.includes(t.id));
    saveTasks();
    renderTasks();
    document.getElementById('settings-modal').style.display = 'none';
  };
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
  };
  document.getElementById('subtab-products').onclick = () => {
    document.getElementById('product-list').style.display = '';
    document.querySelector('.task-tabs').style.display = 'none';
    document.getElementById('task-list').style.display = 'none';
    document.getElementById('subtab-products').classList.add('active');
    document.getElementById('subtab-tasks').classList.remove('active');
  };
  // 設定ボタン
  document.getElementById('settings-btn').onclick = () => {
    document.getElementById('settings-modal').style.display = 'flex';
  };
  document.getElementById('close-settings').onclick = () => {
    document.getElementById('settings-modal').style.display = 'none';
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
