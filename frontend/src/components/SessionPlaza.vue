<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import {
  createSession,
  fetchSessions,
  joinSession,
  leaveSession,
} from "../api/client";
import type { CreateSessionPayload, GameSession } from "../types";

const sessions = ref<GameSession[]>([]);
const loading = ref(false);
const dialogVisible = ref(false);
const submitting = ref(false);
const actingSessionId = ref<string | null>(null);

const NICKNAME_STORAGE_KEY = "lpboardgame.nickname";
const myNickname = ref(localStorage.getItem(NICKNAME_STORAGE_KEY) ?? "");

const createForm = reactive<CreateSessionPayload>({
  title: "",
  gameName: "",
  location: "",
  startTime: "",
  maxPlayers: 4,
  creator: "",
});

const trimmedNickname = computed(() => myNickname.value.trim());

function persistNickname() {
  localStorage.setItem(NICKNAME_STORAGE_KEY, trimmedNickname.value);
}

async function refreshSessions() {
  loading.value = true;
  try {
    sessions.value = await fetchSessions();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "组局列表加载失败");
  } finally {
    loading.value = false;
  }
}

function openCreateDialog() {
  if (!createForm.creator && trimmedNickname.value) {
    createForm.creator = trimmedNickname.value;
  }
  dialogVisible.value = true;
}

async function submitCreate() {
  if (submitting.value) {
    return;
  }
  submitting.value = true;
  try {
    await createSession({
      ...createForm,
      title: createForm.title.trim(),
      gameName: createForm.gameName.trim(),
      location: createForm.location?.trim(),
      creator: createForm.creator.trim(),
    });
    ElMessage.success("组局创建成功");
    dialogVisible.value = false;
    Object.assign(createForm, {
      title: "",
      gameName: "",
      location: "",
      startTime: "",
      maxPlayers: 4,
      creator: trimmedNickname.value,
    });
    await refreshSessions();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "创建组局失败");
  } finally {
    submitting.value = false;
  }
}

function myPlacement(session: GameSession): "confirmed" | "waitlisted" | null {
  const name = trimmedNickname.value;
  if (!name) {
    return null;
  }
  if (session.participants.includes(name)) {
    return "confirmed";
  }
  if (session.waitlist.includes(name)) {
    return "waitlisted";
  }
  return null;
}

function waitlistPosition(session: GameSession, player: string): number {
  return session.waitlist.indexOf(player) + 1;
}

async function handleJoin(session: GameSession) {
  const player = trimmedNickname.value;
  if (!player) {
    ElMessage.warning("请先填写你的昵称再报名");
    return;
  }
  persistNickname();
  actingSessionId.value = session.id;
  try {
    const result = await joinSession(session.id, player);
    ElMessage.success(
      result.placement === "confirmed" ? "报名成功，已进入正式名单" : "人数已满，已加入候补队列",
    );
    await refreshSessions();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "报名失败");
  } finally {
    actingSessionId.value = null;
  }
}

async function handleLeave(session: GameSession) {
  const player = trimmedNickname.value;
  if (!player) {
    return;
  }
  actingSessionId.value = session.id;
  try {
    const result = await leaveSession(session.id, player);
    if (result.promoted) {
      ElMessage.success(`已取消报名，候补玩家「${result.promoted}」自动补位`);
    } else {
      ElMessage.success("已取消报名");
    }
    await refreshSessions();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "取消报名失败");
  } finally {
    actingSessionId.value = null;
  }
}

onMounted(refreshSessions);
</script>

<template>
  <section class="work-panel plaza-panel" aria-label="组局广场">
    <div class="plaza-header">
      <div>
        <h2>组局广场</h2>
        <p class="plaza-subtitle">发起组局招募队友，满员后自动进入候补队列，有人取消时按顺序补位。</p>
      </div>
      <el-button type="primary" size="large" @click="openCreateDialog">发起组局</el-button>
    </div>

    <div class="nickname-bar">
      <span>我的昵称</span>
      <el-input
        v-model="myNickname"
        maxlength="24"
        placeholder="输入昵称后即可报名 / 取消报名"
        style="max-width: 280px"
        @blur="persistNickname"
      />
    </div>

    <el-empty v-if="!loading && sessions.length === 0" description="暂无组局，快来发起第一局吧" />

    <div v-loading="loading" class="session-grid">
      <article v-for="session in sessions" :key="session.id" class="session-card">
        <header class="session-card-header">
          <div>
            <h3>{{ session.title }}</h3>
            <p class="session-meta">
              {{ session.gameName }} · {{ session.startTime }}
              <template v-if="session.location"> · {{ session.location }}</template>
            </p>
            <p class="session-meta">发起人：{{ session.creator }}</p>
          </div>
          <el-tag :type="session.status === 'full' ? 'danger' : 'success'" size="large">
            {{ session.status === "full" ? "已满员" : "招募中" }}
          </el-tag>
        </header>

        <div class="session-counts">
          <span class="pill">正式 {{ session.participantCount }}/{{ session.maxPlayers }}</span>
          <span class="pill pill-warm">候补 {{ session.waitlistCount }} 人</span>
        </div>

        <div class="session-roster">
          <div class="roster-block">
            <strong>正式名单</strong>
            <ol v-if="session.participants.length > 0" class="roster-list">
              <li v-for="player in session.participants" :key="player">
                {{ player }}
                <em v-if="player === session.creator">（发起人）</em>
              </li>
            </ol>
            <p v-else class="roster-empty">虚位以待</p>
          </div>
          <div class="roster-block">
            <strong>候补队列</strong>
            <ol v-if="session.waitlist.length > 0" class="roster-list">
              <li v-for="player in session.waitlist" :key="player">
                <span class="waitlist-order">候补 #{{ waitlistPosition(session, player) }}</span>
                {{ player }}
              </li>
            </ol>
            <p v-else class="roster-empty">暂无候补</p>
          </div>
        </div>

        <footer class="session-actions">
          <template v-if="myPlacement(session) === 'confirmed'">
            <span class="placement-note">你已在正式名单</span>
            <el-button
              type="danger"
              plain
              :loading="actingSessionId === session.id"
              @click="handleLeave(session)"
            >
              取消报名
            </el-button>
          </template>
          <template v-else-if="myPlacement(session) === 'waitlisted'">
            <span class="placement-note">
              你在候补队列第 {{ waitlistPosition(session, trimmedNickname) }} 位
            </span>
            <el-button
              type="danger"
              plain
              :loading="actingSessionId === session.id"
              @click="handleLeave(session)"
            >
              取消候补
            </el-button>
          </template>
          <el-button
            v-else
            type="primary"
            :loading="actingSessionId === session.id"
            @click="handleJoin(session)"
          >
            {{ session.status === "full" ? "报名（进入候补）" : "立即报名" }}
          </el-button>
        </footer>
      </article>
    </div>

    <el-dialog v-model="dialogVisible" title="发起组局" width="min(520px, 92vw)">
      <el-form label-position="top">
        <el-form-item label="组局标题" required>
          <el-input v-model="createForm.title" maxlength="60" placeholder="例如：周五晚阿瓦隆欢乐局" />
        </el-form-item>
        <el-form-item label="桌游名称" required>
          <el-input v-model="createForm.gameName" maxlength="60" placeholder="例如：阿瓦隆" />
        </el-form-item>
        <el-form-item label="开局时间" required>
          <el-date-picker
            v-model="createForm.startTime"
            type="datetime"
            value-format="YYYY-MM-DD HH:mm"
            placeholder="选择开局时间"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="地点">
          <el-input v-model="createForm.location" maxlength="60" placeholder="例如：3 号包厢" />
        </el-form-item>
        <el-form-item label="人数上限" required>
          <el-input-number v-model="createForm.maxPlayers" :min="2" :max="20" />
        </el-form-item>
        <el-form-item label="发起人昵称" required>
          <el-input v-model="createForm.creator" maxlength="24" placeholder="你的昵称" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitCreate">创建组局</el-button>
      </template>
    </el-dialog>
  </section>
</template>
