# Stationery Battle Test — 桌面文具战斗技术小样

固定俯视桌面、几何体铅笔、突刺攻击状态机与 2D 命中判定。  
用于验证操控 / 命中 / 受击 / 小规模混战可行性，**不是完整游戏**。

真实文具模型接入：**待验证**。

## 环境

- Node.js ≥ 18（本机官方 Node 24）
- 开发端口 **5175**（不占用装箱 5174 / 赛车 5173）

## 命令

```powershell
cd C:\Workspace\01_Projects\3D\prototypes\stationery-battle-test
$env:Path = "C:\Program Files\nodejs;" + $env:Path

npm install
npm run dev      # http://127.0.0.1:5175/
# 停止：Ctrl+C

npm test
npm run build
npm run preview  # http://127.0.0.1:4175/
```

## 操作

| 操作 | 输入 |
|---|---|
| 移动 | WASD / 方向键 |
| 朝向 | 鼠标指向桌面 |
| 突刺 | 鼠标左键 |
| 单挑 | `1` |
| 六人混战 | `2` |
| 重开 | `R` |
| 暂停 | `P`（失焦也会暂停并清按键） |
| DEV 调试层 | `F8`（攻击/碰撞范围） |

攻击流程：前摇 → 有效期（锁定朝向并突进检测）→ 收招。同一次挥击对同一目标只结算一次伤害。

## 结构

- `src/config.ts` — 核心数值
- `src/logic/` — 战斗状态、路径命中、AI、胜负（可单测）
- `src/view/` — Three.js 表现
- `src/input/` — 键鼠

## 验证

见 `_verify/BATTLE_VERIFY.md`。
