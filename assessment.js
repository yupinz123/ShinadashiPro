'use strict';
const userNameInput = document.getElementById('user-name');
const assessmentButton = document.getElementById('assessment');
const resultDivided = document.getElementById('result-area');
const tweetDivided = document.getElementById('tweet-area');

assessmentButton.onclick = () => {
  const userName = userNameInput.value;
  if (userName.length === 0) {
    // 名前が空の時は処理を終了する
    return;
  }

  // 診断結果表示エリアの作成
  resultDivided.innerText = "";
  const header = document.createElement('h3');
  header.innerText = '診断結果';
  resultDivided.appendChild(header);

  const paragraph = document.createElement('p');
  const result = assessment(userName);
  paragraph.innerText = result[0];
  resultDivided.appendChild(paragraph);

  const png = document.createElement('img');
  const index = result[1];
  img.src = images[index]
  resultDivided.appendChild(png);

  // ツイートエリアの作成
  tweetDivided.innerText = "";
  const anchor = document.createElement('a');
  const hrefValue =
    'https://twitter.com/intent/tweet?button_hashtag=' +
    encodeURIComponent('あなたの使うべき原神キャラ') +
    '&ref_src=twsrc%5Etfw';
  anchor.setAttribute('href', hrefValue);
  anchor.className = 'twitter-hashtag-button';
  anchor.setAttribute('data-text', result[0]);
  anchor.innerText = 'Tweet #あなたの使うべき原神キャラ';
  tweetDivided.appendChild(anchor);

  // widgets.js の設定
  const script = document.createElement('script');
  script.setAttribute('src', 'https://platform.twitter.com/widgets.js');
  tweetDivided.appendChild(script);
  };

  userNameInput.onkeydown = event => {
    if (event.key === 'Enter') {
      assessmentButton.onclick();
    }
};

const answers = [
  '{userName}におすすめのキャラは甘雨です。重撃による瞬間火力を出せる甘雨は{userName}にとって非常に扱っていて楽しいキャラでしょう。',
  '{userName}におすすめのキャラは胡桃です。{userName}にとって胡桃の重撃ループは非常に爽快でしょう。',
  '{userName}におすすめのキャラは楓原万葉です。万葉の便利さは{userName}のチーム全体をサポートしてくれるでしょう。',
  '{userName}におすすめのキャラは神里綾華です。使い勝手の良い神里綾華は{userName}にとって優秀なメインを張れるアタッカーとなるでしょう。',
  '{userName}におすすめのキャラは雷電将軍です。{userName}が使う雷電将軍はチーム全員のサポーターとして非常に優秀なキャラとなるでしょう。',
  '{userName}におすすめのキャラはウェンティです。ウェンティの元素爆発の強さは{userName}の日々の探索を楽にしてくれるでしょう。',
  '{userName}におすすめのキャラは趙です。趙の落下攻撃は{userName}が行くどの秘境でも活躍する事でしょう。',
  '{userName}におすすめのキャラは鍾離。{userName}にとって鍾離のシールドは必要不可欠な存在になるでしょう。',
];

var img = [];
const images = [
  img[0] = 'https://yupinz123.github.io/assessment/Ganyu.png',
  img[1] = 'https://yupinz123.github.io/assessment/Hu Tao.png',
  img[2] = 'https://yupinz123.github.io/assessment/Kaedehara Kazuha.png',
  img[3] = 'https://yupinz123.github.io/assessment/Kamisato Ayaka.png',
  img[4] = 'https://yupinz123.github.io/assessment/Raiden Shogun.png',
  img[5] = 'https://yupinz123.github.io/assessment/Venti.png',
  img[6] = 'https://yupinz123.github.io/assessment/Xiao.png',
  img[7] = 'https://yupinz123.github.io/assessment/Zhongli.png',
];

/**
 * 名前の文字列を渡すと診断結果を返す関数
 * @param {string} userName ユーザーの名前
 * @return {string} 診断結果
 */
function assessment(userName) {
  // 全文字のコード番号を取得してそれを足し合わせる
  let sumOfCharCode = 0;
  for (let i = 0; i < userName.length; i++) {
    sumOfCharCode = sumOfCharCode + userName.charCodeAt(i);
  }

  // 文字のコード番号の合計を回答の数で割って添字の数値を求める
  const index = sumOfCharCode % answers.length;
  let result = answers[index];

  result = result.replaceAll('{userName}', userName);
  return [result, index];;
};
