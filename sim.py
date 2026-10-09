"""节奏模拟：用一套固定打法把游戏从头跑一遍，打印每个节点出现的时间。

改了 index.html 里的数值以后，把下面的常量改成一样的，再运行：

    python3 sim.py

打法（和设计时用的一致）：
- 前 5 棵树之前每秒手动摘 3 下；果子够就种树。
- 仓库第一次满时每秒砍 3 下柴，够 20 个就扩建。
- 林木数量按仓库等级种到 TIMBER_PLAN。
- 出现卖果以后，优先攒钱买五金店的四件工具。
- 买完高梯以后，产出的果子一半留着种树和扩建，一半卖掉；
  三个货架里哪件最便宜就先买哪件。

它只是一个固定打法，真人会更聪明（比如先买汽车再买电动三轮），
所以时间是参考值，用来比较改动前后的快慢。
"""
import math

# ---- 和 index.html 保持一致的数值 ----
TREE_BASE, TREE_GROWTH = 10, 1.15          # 果树价格
TIMBER_BASE, TIMBER_GROWTH = 50, 1.15      # 林木价格
TIMBER_RATE = 0.5                          # 每棵林木每秒产的木头
WOOD_FOR_EXPAND = [20, 200, 1000]          # 前三次扩建要的木头，之后是上限的 40%
TOOLS = [(50, 0), (100, 0), (200, 300), (500, 0)]   # 梯子 锯子 果摊 高梯：(钱, 木头)
TECH = [(500, '手推车'), (8000, '电动三轮')]
LUX = [(1200, '新衣服'), (12000, '汽车'), (100000, '房子')]
PROD = [(3000, 1.5, '修枝剪'), (15000, 1.5, '喷灌'), (60000, 1.5, '拖拉机')]
# (需要的面子, 每 100 个果子的钱, 收购量上限, 每秒恢复)
BUYERS = [(0, 10, 0, 0), (1, 20, 3000, 40), (2, 40, 30000, 200), (3, 80, 300000, 1000)]
SELL_UNLOCK_TREES = 30

# ---- 打法 ----
CLICKS_PER_SECOND = 3
TIMBER_PLAN = {1: 3, 2: 5, 3: 8, 4: 12, 5: 16}
SELL_SHARE = 0.5


def cap(level):
    return 100 * 5 ** level


def wood_for_expand(level):
    return WOOD_FOR_EXPAND[level] if level < len(WOOD_FOR_EXPAND) else round(cap(level) * 0.4)


def clock(t):
    t = int(t)
    if t >= 3600:
        return f"{t // 3600}:{t % 3600 // 60:02d}:{t % 60:02d}"
    return f"{t // 60}:{t % 60:02d}"


def run(max_seconds=4 * 3600):
    dt = 0.05
    t = fruit = wood = money = 0.0
    trees = timber = level = tools = tech = lux = prod = 0
    demand = [b[2] for b in BUYERS]
    selling = False
    events = []

    def fruit_rate():
        r = trees * (1.5 if tools >= 1 else 1) * (1.5 if tools >= 4 else 1)
        for i in range(prod):
            r *= PROD[i][1]
        return r

    def sell(q):
        """卖掉 q 个果子：先卖给出价高、还收得下的买家，剩下的卖给村口。"""
        nonlocal money
        for i in range(len(BUYERS) - 1, 0, -1):
            if lux >= BUYERS[i][0] and demand[i] > 0:
                x = min(q, demand[i])
                demand[i] -= x
                q -= x
                money += x * BUYERS[i][1] / 100
        money += q * BUYERS[0][1] / 100

    while t < max_seconds:
        c = cap(level)
        click_fruit = CLICKS_PER_SECOND if trees < 5 else 0
        click_wood = CLICKS_PER_SECOND if (level == 0 and fruit >= c - 1 and wood < WOOD_FOR_EXPAND[0]) else 0
        for i in range(1, len(BUYERS)):
            if lux >= BUYERS[i][0]:
                demand[i] = min(BUYERS[i][2], demand[i] + BUYERS[i][3] * dt)

        stage5 = tools >= len(TOOLS)
        gain = (click_fruit + fruit_rate()) * dt
        if stage5:
            sell(gain * SELL_SHARE)
            gain *= 1 - SELL_SHARE
        fruit += gain
        if fruit > c:
            if tools >= 3:          # 有果摊：放不下的自动卖掉
                sell(fruit - c)
            fruit = c
        wood = min(c, wood + (click_wood + timber * TIMBER_RATE * (2 if tools >= 2 else 1)) * dt)
        t += dt

        if not selling and trees >= SELL_UNLOCK_TREES:
            selling = True
            events.append(f"{clock(t)}  卖果出现")

        if stage5:
            shelf = []
            if tech < len(TECH):
                shelf.append((TECH[tech][0], 'tech', TECH[tech][1]))
            if tech >= 1 and lux < len(LUX):
                shelf.append((LUX[lux][0], 'lux', LUX[lux][1]))
            if lux >= 1 and prod < len(PROD):
                shelf.append((PROD[prod][0], 'prod', PROD[prod][2]))
            if shelf:
                price, kind, name = min(shelf)
                if money >= price:
                    money -= price
                    if kind == 'tech':
                        tech += 1
                    elif kind == 'lux':
                        lux += 1
                    else:
                        prod += 1
                    events.append(f"{clock(t)}  {name}（{price:,} 钱），果子每秒 {fruit_rate():.0f}")
            else:
                break

        changed = True
        while changed:
            changed = False
            c = cap(level)
            tree_cost = math.ceil(TREE_BASE * TREE_GROWTH ** trees)
            timber_cost = math.ceil(TIMBER_BASE * TIMBER_GROWTH ** timber)
            if selling and tools < len(TOOLS):
                need_money, need_wood = TOOLS[tools]
                if money < need_money:
                    if fruit >= 100:
                        fruit -= 100
                        money += 10
                        changed = True
                    continue
                if wood >= need_wood:
                    money -= need_money
                    wood -= need_wood
                    tools += 1
                    events.append(f"{clock(t)}  {['梯子', '锯子', '果摊', '高梯'][tools - 1]}")
                    changed = True
                    continue
            if level >= 1 and timber < TIMBER_PLAN.get(level, 20) and timber_cost <= c:
                if fruit >= timber_cost:
                    fruit -= timber_cost
                    timber += 1
                    changed = True
                continue
            if tree_cost <= c:
                if fruit >= tree_cost:
                    fruit -= tree_cost
                    trees += 1
                    if trees == 1:
                        events.append(f"{clock(t)}  第一棵树")
                    changed = True
                continue
            if fruit >= c and wood >= wood_for_expand(level):
                fruit -= c
                wood -= wood_for_expand(level)
                level += 1
                events.append(f"{clock(t)}  第 {level} 次扩建，上限 {cap(level):,}（果树 {trees}，林木 {timber}）")
                changed = True
    return events


if __name__ == '__main__':
    for line in run():
        print(line)
