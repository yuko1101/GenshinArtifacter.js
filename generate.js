const fs = require("fs");
const { EnkaClient, Character, ArtifactSet, StatusProperty } = require("enka-network-api");
const { Canvas, createCanvas, loadImage, registerFont } = require("canvas");

const enka = new EnkaClient({ cacheDirectory: "./cache", defaultLanguage: "jp" });

generate(825436941, 0);

/**
 * @param {number | string} uid
 * @param {number} characterIndex
 */
async function generate(uid, characterIndex) {

    // 原神のゲームデータの更新
    if (await enka.cachedAssetsManager.checkForUpdates()) {
        await enka.cachedAssetsManager.fetchAllContents();
    }

    // フォントの登録
    registerFont("./assets/fonts/genshin.ttf", { family: "genshin" });

    const user = await enka.fetchUser(uid);
    if (user.characters.length - 1 < characterIndex) throw new Error("指定されたキャラクター情報がありません");
    const character = user.characters[characterIndex];

    const canvas = await generateImage(character, ["FIGHT_PROP_CRITICAL", "FIGHT_PROP_CRITICAL_HURT", "FIGHT_PROP_ATTACK_PERCENT"]);

    fs.writeFileSync("./generated.png", canvas.toBuffer("image/png"));
}

const multipliers = {
    "FIGHT_PROP_CRITICAL": 2, // 会心率
    "FIGHT_PROP_CRITICAL_HURT": 1, // 会心ダメージ
    "FIGHT_PROP_ATTACK_PERCENT": 1, // 攻撃力%
    "FIGHT_PROP_HP_PERCENT": 1, // HP% 
    "FIGHT_PROP_DEFENSE_PERCENT": 0.8, // 防御力% 
    "FIGHT_PROP_CHARGE_EFFICIENCY": 1, // 元素チャージ効率
    "FIGHT_PROP_ELEMENT_MASTERY": 0.25, // 元素熟知
};

const pointRefer = {
    "total": {
        "SS": 220,
        "S": 200,
        "A": 180,
    },
    "EQUIP_BRACER": {
        "SS": 50,
        "S": 45,
        "A": 40,
    },
    "EQUIP_NECKLACE": {
        "SS": 50,
        "S": 45,
        "A": 40,
    },
    "EQUIP_SHOES": {
        "SS": 45,
        "S": 40,
        "A": 35,
    },
    "EQUIP_RING": {
        "SS": 45,
        "S": 40,
        "A": 35,
    },
    "EQUIP_DRESS": {
        "SS": 40,
        "S": 35,
        "A": 30,
    },
};

/**
 * @param {Character} character
 * @param {StatusProperty.FightProp[]} buildElements
 * @returns {Promise<Canvas>}
*/
async function generateImage(character, buildElements) {

    // 必要な聖遺物情報の取得
    const artifactList = Object.fromEntries(character.artifacts.map(a => [a.artifactData.equipType, a]));

    const artifactSetCounts = character.artifacts.reduce((countList, a) => {
        countList[a.artifactData.set.id] = (countList[a.artifactData.set.id] ?? 0) + 1
        return countList;
    }, {});
    const artifactSet = [];
    for (const setCountEntry of Object.entries(artifactSetCounts)) {
        const set = new ArtifactSet(Number(setCountEntry[0]), enka);
        const artifactSet1 = set.setBonus[0];
        const artifactSet2 = set.setBonus[1] || null;
        if (setCountEntry[1] >= artifactSet1.needCount) {
            if (artifactSet2 !== null && setCountEntry[1] >= artifactSet2.needCount) {
                artifactSet.push([artifactSet2.needCount, set.name.get()]);
            } else {
                artifactSet.push([artifactSet1.needCount, set.name.get()]);
            }
        }
    }

    const scores = Object.fromEntries(Object.entries(artifactList).map(([equipType, a]) => [equipType, a.substats.total.reduce((score, substat) => score + (buildElements.includes(substat.id) ? substat.getFormattedValue() * multipliers[substat.id] : 0), 0)]));

    // 画像生成
    const characterImage = await loadSavedImage(character.characterData.splashImage.url);
    const characterMask = await loadImage(`./assets/masks/${character.characterData.id === 10000078 ? "alhaitham" : "character"}_mask.png`);
    const characterCanvas = createCanvas(1439 * 0.75, 1024 * 0.75);
    const characterCtx = characterCanvas.getContext("2d");
    characterCtx.drawImage(characterMask, 0, 0, characterCanvas.width, characterCanvas.height);
    characterCtx.globalCompositeOperation = "source-in";
    characterCtx.drawImage(characterImage, 289, 0, 1439, 1024, 0, 0, 1439 * 0.75, 1024 * 0.75);

    const weaponImage = await loadSavedImage(character.weapon.isAwaken ? character.weapon.weaponData.awakenIcon.url : character.weapon.weaponData.icon.url);
    const weaponRarityImage = await loadImage(`./assets/rarity/${character.weapon.weaponData.stars}.png`);
    const weaponMainStat = character.weapon.weaponStats[0];
    const weaponSubStat = character.weapon.weaponStats[1];
    const weaponMainStatImage = weaponMainStat ? await loadImage(`./assets/fight_prop/${weaponMainStat.id}.png`) : null;
    const weaponSubStatImage = weaponSubStat ? await loadImage(`./assets/fight_prop/${weaponSubStat.id}.png`) : null;

    const talentBackground = await loadImage("./assets/talent_background.png");

    const constellationBackground = await loadImage(`./assets/constellations/${character.characterData.element.id}.png`);
    const constellationLock = await loadImage(`./assets/constellations/${character.characterData.element.id}_lock.png`);

    const artifactMask = await loadImage("./assets/masks/artifact_mask.png");
    const artifactBrightness = await loadImage("./assets/masks/artifact_brightness.png");

    const friendship = await loadImage("./assets/misc/friendship.png");

    const damageBonus = await loadImage(`./assets/fight_prop/${(character.status.highestDamageBonus?.[0] || character.status.matchedElementDamage).id}.png`);

    const scoreSS = await loadImage("./assets/score/SS.png");
    const scoreS = await loadImage("./assets/score/S.png");
    const scoreA = await loadImage("./assets/score/A.png");
    const scoreB = await loadImage("./assets/score/B.png");

    const shadow = await loadImage("./assets/masks/shadow.png");
    const image = await loadImage(`./assets/base/${character.characterData.element.id}.png`);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext("2d");
    ctx.textBaseline = "top";
    ctx.drawImage(image, 0, 0);
    ctx.drawImage(characterCanvas, -160, -45);
    ctx.drawImage(weaponImage, 1430, 50, 128, 128);
    ctx.drawImage(weaponRarityImage, 1422, 173, weaponRarityImage.width * 0.97, weaponRarityImage.height * 0.97);
    ctx.drawImage(shadow, 0, 0, canvas.width, canvas.height);
    for (let i = 0; i < 3; i++) {
        const talent = character.skillLevels[i];
        const talentImage = await loadSavedImage(talent.skill.icon.url);
        const talentCanvas = createCanvas(talentBackground.width / 1.5, talentBackground.height / 1.5);
        const talentCtx = talentCanvas.getContext("2d");
        talentCtx.drawImage(talentBackground, 0, 0, talentCanvas.width, talentCanvas.height);
        talentCtx.drawImage(talentImage, talentCanvas.width / 2 - 25, talentCanvas.height / 2 - 25, 50, 50);
        ctx.font = "17px \"genshin\"";
        ctx.fillStyle = "rgb(255, 255, 255)";
        if (talent.level.extra) ctx.fillStyle = "rgb(56, 255, 255)";
        if (talent.level.base === 10) ctx.fillStyle = "rgb(255, 195, 0)";
        ctx.drawImage(talentCanvas, 15, 330 + 105 * i);
        ctx.fillText(`Lv.${talent.level.value}`, 42, 397 + 105 * i);
    }
    for (let i = 0; i < 6; i++) {
        if (i + 1 > character.unlockedConstellations.length) {
            ctx.drawImage(constellationLock, 666, 83 + 93 * i, 90, 90);
            continue;
        }
        const constellation = character.unlockedConstellations[i];
        const constellationImage = await loadImage(constellation.icon.url);
        const constellationCanvas = createCanvas(90, 90);
        const constellationCtx = constellationCanvas.getContext("2d");
        constellationCtx.drawImage(constellationBackground, 0, 0, constellationCanvas.width, constellationCanvas.height);
        constellationCtx.drawImage(constellationImage, constellationCanvas.width / 2 - 25, constellationCanvas.height / 2 - 23, 45, 45);
        ctx.drawImage(constellationCanvas, 666, 83 + 93 * i);
    }
    for (let i = 0; i < 5; i++) {
        const artifact = Object.entries(artifactList)[i][1];
        if (!artifact) continue;
        const artifactCanvas = createCanvas(333, 333);
        const artifactCtx = artifactCanvas.getContext("2d");
        const artifactImage = await loadSavedImage(artifact.artifactData.icon.url);
        artifactCtx.drawImage(artifactMask, 0, 0, artifactCanvas.width, artifactCanvas.height);
        artifactCtx.globalCompositeOperation = "source-in";
        artifactCtx.drawImage(artifactImage, 0, 0, artifactCanvas.width, artifactCanvas.height);
        artifactCtx.globalCompositeOperation = "source-atop";
        artifactCtx.drawImage(artifactBrightness, 0, 0, artifactCanvas.width, artifactCanvas.height);
        if (i === 0 || i === 4) {
            ctx.drawImage(artifactCanvas, -37 + 373 * i, 570);
        } else if (i === 1 || i === 3) {
            ctx.drawImage(artifactCanvas, -36 + 373 * i, 570);
        } else {
            ctx.drawImage(artifactCanvas, -35 + 373 * i, 570);
        }
        ctx.textAlign = "end";
        ctx.font = "29px \"genshin\"";
        ctx.fillStyle = "rgb(255, 255, 255)";
        const artifactMainText = artifact.mainstat.type.get().replace("元素チャージ効率", "元チャ効率");
        const artifactMainLength = ctx.measureText(artifactMainText);
        ctx.fillText(artifactMainText, 375 + 373 * i, 655);
        const mainOpIcon = await loadImage(`./assets/fight_prop/${artifact.mainstat.id}.png`);
        ctx.drawImage(mainOpIcon, 340 + 373 * i - artifactMainLength, 655, 35, 35);
        ctx.font = "49px \"genshin\"";
        ctx.fillText(artifact.mainstat.toString(), 375 + 373 * i, 690);
        ctx.font = "21px \"genshin\"";
        const artifactLvLength = ctx.measureText(`+${artifact.level - 1}`).width;
        ctx.fillStyle = "rgb(0, 0, 0)";
        fillRoundRect(ctx, 373 + 373 * i - artifactLvLength, 748, 2 + artifactLvLength, 23, 2);
        ctx.fillStyle = "rgb(255, 255, 255)";
        ctx.fillText(`+${artifact.level - 1}`, 374 + 373 * i, 749);
        for (let u = 0; u < artifact.substats.total.length; u++) {
            const substat = artifact.substats.total[u];
            const distribution = artifact.substats.split.filter(e => substat.id === e.id);
            const distributionText = distribution.map(e => substat.isPercent ? (100 * e.value).toFixed(1) : e.value.toFixed()).join("+");
            ctx.textAlign = "start";
            ctx.font = "25px \"genshin\"";
            ctx.fillStyle = "rgb(255, 255, 255)";
            if (!buildElements.includes(substat.id)) ctx.fillStyle = "rgb(180, 180, 180)";
            ctx.fillText(`${substat.type.get().replace("元素チャージ効率", "元チャ効率")}`, 79 + 373 * i, 811 + 50 * u);
            const subIcon = await loadImage(`./assets/fight_prop/${substat.id}.png`);
            ctx.drawImage(subIcon, 44 + 373 * i, 811 + 50 * u, 30, 30);
            ctx.textAlign = "end";
            ctx.fillText(substat.toString(), 375 + 373 * i, 811 + 50 * u);
            ctx.font = "11px \"genshin\"";
            ctx.fillStyle = "rgb(170, 170, 170)";
            ctx.fillText(distributionText, 375 + 373 * i, 840 + 50 * u);
        }
        ctx.textAlign = "end";
        ctx.font = "36px \"genshin\"";
        ctx.fillStyle = "rgb(255, 255, 255)";
        const artifactScore = Math.round(10 * scores[artifact.artifactData.equipType]) / 10;
        const artifactScoreLength = ctx.measureText(artifactScore.toFixed(1)).width;
        ctx.fillText(artifactScore.toFixed(1), 380 + 373 * i, 1016);
        ctx.textAlign = "start";
        ctx.font = "27px \"genshin\"";
        ctx.fillStyle = "rgb(160, 160, 160)";
        ctx.fillText("Score", 295 + 373 * i - artifactScoreLength, 1025);
        let scoreImage;
        if (artifactScore >= pointRefer[artifact.artifactData.equipType]["SS"]) scoreImage = scoreSS;
        else if (artifactScore >= pointRefer[artifact.artifactData.equipType]["S"]) scoreImage = scoreS;
        else if (artifactScore >= pointRefer[artifact.artifactData.equipType]["A"]) scoreImage = scoreA;
        else scoreImage = scoreB;
        ctx.drawImage(scoreImage, 85 + 373 * i, 1013, scoreImage.width / 11, scoreImage.height / 11);
    }

    ctx.textAlign = "start";
    ctx.fillStyle = "rgb(255, 255, 255)";
    ctx.font = "48px \"genshin\"";
    ctx.fillText(character.characterData.name.get(), 30, 20);
    ctx.font = "25px \"genshin\"";
    const lvText = `Lv.${character.level}`;
    ctx.fillText(lvText, 35, 75);
    const lvLength = ctx.measureText(lvText).width;
    const friendshipLength = ctx.measureText(`${character.friendship}`).width;
    ctx.fillStyle = "rgb(0, 0, 0)";
    fillRoundRect(ctx, 5 + lvLength + 35, 74, 37 + friendshipLength, 28, 2);
    ctx.drawImage(friendship, 42 + lvLength, 76, friendship.width * 24 / friendship.height, 24);
    ctx.fillStyle = "rgb(255, 255, 255)";
    ctx.fillText(`${character.friendship}`, lvLength + 73, 74);
    ctx.drawImage(damageBonus, 789, 555, 40, 40);
    ctx.font = "26px \"genshin\"";
    ctx.fillText((character.status.highestDamageBonus?.[0] || character.status.matchedElementDamage).type.get(), 844, 557);
    const statusList = [Math.round(character.status.healthBase.value * (1 + character.status.healthPercent.value) + character.status.healthFlat.value).toLocaleString(), Math.round(character.status.attack.value).toLocaleString(), Math.round(character.status.defense.value).toLocaleString(), Math.round(character.status.elementMastery.value).toLocaleString(), `${character.status.critRate.getFormattedValue().toFixed(1)}%`, `${character.status.critDamage.getFormattedValue().toFixed(1)}%`, `${character.status.chargeEfficiency.getFormattedValue().toFixed(1)}%`, `${(character.status.highestDamageBonus?.[0] || character.status.matchedElementDamage).getFormattedValue().toFixed(1)}%`];
    ctx.textAlign = "end";
    for (let i = 0; i < 8; i++) {
        ctx.font = "12px \"genshin\"";
        if (i === 0) {
            const text = "+" + Math.round(character.status.healthBase.value * character.status.healthPercent.value + character.status.healthFlat.value).toLocaleString();
            const textLength = ctx.measureText(text).width;
            ctx.fillStyle = "rgba(0, 255, 0, 180)";
            ctx.fillText(`${text}`, 1360, 97 + 70 * i);
            ctx.fillStyle = "rgba(255, 255, 255, 180)";
            ctx.fillText(`${Math.round(character.status.healthBase.value).toLocaleString()}`, 1360 - textLength - 1, 97 + 70 * i);
        }
        if (i === 1) {
            const text = "+" + Math.round(character.status.attack.value - character.status.attackBase.value).toLocaleString();
            const textLength = ctx.measureText(text).width;
            ctx.fillStyle = "rgba(0, 255, 0, 180)";
            ctx.fillText(`${text}`, 1360, 97 + 70 * i);
            ctx.fillStyle = "rgba(255, 255, 255, 180)";
            ctx.fillText(`${Math.round(character.status.attackBase.value).toLocaleString()}`, 1360 - textLength - 1, 97 + 70 * i);
        }
        if (i === 2) {
            const text = "+" + Math.round(character.status.defense.value - character.status.defenseBase.value).toLocaleString();
            const textLength = ctx.measureText(text).width;
            ctx.fillStyle = "rgba(0, 255, 0, 180)";
            ctx.fillText(`${text}`, 1360, 97 + 70 * i);
            ctx.fillStyle = "rgba(255, 255, 255, 180)";
            ctx.fillText(`${Math.round(character.status.defenseBase.value).toLocaleString()}`, 1360 - textLength - 1, 97 + 70 * i);
        }
        ctx.fillStyle = "rgb(255, 255, 255)";
        ctx.font = "26px \"genshin\"";
        ctx.fillText(statusList[i], 1360, 67 + 70 * i);
    }
    ctx.textAlign = "start";
    ctx.fillStyle = "rgb(255, 255, 255)";
    ctx.font = "26px \"genshin\"";
    ctx.fillText(character.weapon.weaponData.name.get(), 1582, 47);
    ctx.font = "24px \"genshin\"";
    const weapomLvText = `Lv.${character.weapon.level}`;
    const weaponLvLength = ctx.measureText(weapomLvText).width;
    ctx.fillStyle = "rgb(0, 0, 0)";
    fillRoundRect(ctx, 1582, 80, weaponLvLength + 4, 28, 1);
    ctx.fillStyle = "rgb(255, 255, 255)";
    ctx.fillText(weapomLvText, 1584, 82);
    if (weaponMainStat) {
        ctx.font = "23px \"genshin\"";
        ctx.drawImage(weaponMainStatImage, 1600, 123, 23, 23);
        ctx.fillText(`${weaponMainStat.type.get().replace("元素チャージ効率", "元チャ効率")}  ${weaponMainStat.getFormattedValue().toFixed(weaponMainStat.isPercent ? 1 : 0)}${weaponMainStat.isPercent ? "%" : ""}`, 1623, 120);
    }
    if (weaponSubStat) {
        ctx.font = "23px \"genshin\"";
        ctx.drawImage(weaponSubStatImage, 1600, 158, 23, 23);
        ctx.fillText(`${weaponSubStat.type.get().replace("元素チャージ効率", "元チャ効率")}  ${weaponSubStat.getFormattedValue().toFixed(weaponSubStat.isPercent ? 1 : 0)}${weaponSubStat.isPercent ? "%" : ""}`, 1623, 155);
    }
    ctx.fillStyle = "rgb(0, 0, 0)";
    fillRoundRect(ctx, 1430, 45, 40, 25, 1);
    ctx.font = "24px \"genshin\"";
    ctx.fillStyle = "rgb(255, 255, 255)";
    ctx.fillText(`R${character.weapon.refinement?.level || 1}`, 1433, 46);

    ctx.font = "23px \"genshin\"";
    if (artifactSet.length === 0) {
        ctx.fillText("セット効果なし", 1536, 263);
        ctx.fillStyle = "rgb(255, 255, 255)";
    } else if (artifactSet.length === 1) {
        ctx.fillStyle = "rgb(0, 255, 0)";
        ctx.fillText(artifactSet[0][1], 1536, 263);
        ctx.fillStyle = "rgb(0, 0, 0)";
        fillRoundRect(ctx, 1818, 263, 44, 25, 1);
        ctx.fillStyle = "rgb(255, 255, 255)";
        ctx.font = "19px \"genshin\"";
        ctx.textAlign = "center";
        ctx.fillText(`${artifactSet[0][0]}`, 1840, 265);
    } else if (artifactSet.length === 2) {
        ctx.fillStyle = "rgb(0, 255, 0)";
        ctx.fillText(artifactSet[0][1], 1536, 245);
        ctx.fillText(artifactSet[1][1], 1536, 280);
        ctx.fillStyle = "rgb(0, 0, 0)";
        fillRoundRect(ctx, 1818, 245, 44, 25, 1);
        fillRoundRect(ctx, 1818, 280, 44, 25, 1);
        ctx.fillStyle = "rgb(255, 255, 255)";
        ctx.font = "19px \"genshin\"";
        ctx.textAlign = "center";
        ctx.fillText(`${artifactSet[0][0]}`, 1840, 245);
        ctx.fillText(`${artifactSet[1][0]}`, 1840, 280);
    } else if (artifactSet.length === 3) {
        ctx.fillStyle = "rgb(0, 255, 0)";
        ctx.fillText(artifactSet[0][1], 1536, 236);
        ctx.fillText(artifactSet[1][1], 1536, 264);
        ctx.fillText(artifactSet[2][1], 1536, 292);
        ctx.fillStyle = "rgb(0, 0, 0)";
        fillRoundRect(ctx, 1818, 236, 44, 25, 1);
        fillRoundRect(ctx, 1818, 264, 44, 25, 1);
        fillRoundRect(ctx, 1818, 292, 44, 25, 1);
        ctx.fillStyle = "rgb(255, 255, 255)";
        ctx.font = "19px \"genshin\"";
        ctx.textAlign = "center";
        ctx.fillText(`${artifactSet[0][0]}`, 1840, 236);
        ctx.fillText(`${artifactSet[1][0]}`, 1840, 264);
        ctx.fillText(`${artifactSet[2][0]}`, 1840, 292);
    }
    ctx.textAlign = "start";
    const totalScore = Math.round(10 * (scores["EQUIP_BRACER"] + scores["EQUIP_NECKLACE"] + scores["EQUIP_SHOES"] + scores["EQUIP_RING"] + scores["EQUIP_DRESS"])) / 10;
    let totalScoreImage;
    if (totalScore >= pointRefer["total"]["SS"]) totalScoreImage = scoreSS;
    else if (totalScore >= pointRefer["total"]["S"]) totalScoreImage = scoreS;
    else if (totalScore >= pointRefer["total"]["A"]) totalScoreImage = scoreA;
    else totalScoreImage = scoreB;
    ctx.textAlign = "center";
    ctx.font = "75px \"genshin\"";
    ctx.fillText(totalScore.toFixed(1), 1652, 420);
    ctx.textAlign = "start";
    ctx.drawImage(totalScoreImage, 1806, 345, totalScoreImage.width / 8, totalScoreImage.height / 8);

    ctx.textBaseline = "middle";
    ctx.font = "20px \"genshin\"";
    let addX = 0;
    for (const fightProp of buildElements) {
        const fightPropImage = await loadImage(`./assets/fight_prop/${fightProp}.png`);
        ctx.drawImage(fightPropImage, 1435 + addX, 600 - 15, 30, 30);
        addX += 30;
        ctx.fillText(`:${multipliers[fightProp]}`, 1435 + addX, 600);
        addX += ctx.measureText(`:${multipliers[fightProp]}`).width + 8;
    }

    return canvas;
}
function fillRoundRect(ctx, x, y, w, h, r) {
    createRoundRectPath(ctx, x, y, w, h, r);
    ctx.fill();
}
function createRoundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arc(x + w - r, y + r, r, Math.PI * (3 / 2), 0, false);
    ctx.lineTo(x + w, y + h - r);
    ctx.arc(x + w - r, y + h - r, r, 0, Math.PI * (1 / 2), false);
    ctx.lineTo(x + r, y + h);
    ctx.arc(x + r, y + h - r, r, Math.PI * (1 / 2), Math.PI, false);
    ctx.lineTo(x, y + r);
    ctx.arc(x + r, y + r, r, Math.PI, Math.PI * (3 / 2), false);
    ctx.closePath();
}
/**
 * @param {string} url
 * @returns {Promise<Image>}
 */
async function loadSavedImage(url) {
    if (!fs.existsSync("./image_cache")) fs.mkdirSync("./image_cache");
    const filePath = `./image_cache/${url.split("/").slice(-1)[0]}`;
    if (!fs.existsSync(filePath)) {
        const loadedImage = await loadImage(url);
        const canvas = createCanvas(loadedImage.width, loadedImage.height);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(loadedImage, 0, 0);
        const buffer = canvas.toBuffer("image/png");
        fs.writeFileSync(filePath, buffer);
        return loadedImage;
    } else {
        return await loadImage(filePath);
    }
}