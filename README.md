# GenshinArtifacter.js
HyugoさんのArtifacterのNode.js版です


## 必要なもの
- Node.js 16以降
- Linux推奨 (もしくはDocker等の使用)
- git (リポジトリのクローンに使用します)

## 使い方

1.このリポジトリをクローンします。
```shell
git clone https://github.com/yuko1101/GenshinArtifacter.js.git
```

2.以下のコマンドで必要なNPMパッケージをインストールします。
```shell
npm i
```

3.generate.jsを実行すると画像を生成できます。(generated.pngとして生成されます)
```shell
node generate.js
```

注意: Windows上では原神のフォントが正しく読み込まれない場合があります。
Docker等の使用を検討してください。(MacOSは未検証、Linuxでは問題なく読み込まれます)

## クレジット
- [FuroBath/ArtifacterImageGen](https://github.com/FuroBath/ArtifacterImageGen) - [MIT License](https://github.com/FuroBath/ArtifacterImageGen/blob/master/LICENSE)