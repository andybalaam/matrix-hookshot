import { IssuesGetResponseData } from "../Github/Types";
import { Redis, default as redis } from "ioredis";
import LogWrapper from "../LogWrapper";

import { IBridgeStorageProvider } from "./StorageProvider";
import { IFilterInfo } from "matrix-bot-sdk";

const BOT_SYNC_TOKEN_KEY = "bot.sync_token.";
const BOT_FILTER_KEY = "bot.filter.";
const BOT_VALUE_KEY = "bot.value.";
const REGISTERED_USERS_KEY = "as.registered_users";
const COMPLETED_TRANSACTIONS_KEY = "as.completed_transactions";
const GH_ISSUES_KEY = "gh.issues";
const GH_ISSUES_LAST_COMMENT_KEY = "gh.issues.last_comment";
const GH_ISSUES_REVIEW_DATA_KEY = "gh.issues.review_data";
const COMPLETED_TRANSACTIONS_EXPIRE_AFTER = 24 * 60 * 60; // 24 hours
const ISSUES_EXPIRE_AFTER = 7 * 24 * 60 * 60; // 7 days
const ISSUES_LAST_COMMENT_EXPIRE_AFTER = 14 * 24 * 60 * 60; // 7 days

const log = new LogWrapper("RedisASProvider");

export class RedisStorageProvider implements IBridgeStorageProvider {
    private redis: Redis;

    constructor(host: string, port: number, private contextSuffix = '') {
        this.redis = new redis(port, host);
        this.redis.expire(COMPLETED_TRANSACTIONS_KEY, COMPLETED_TRANSACTIONS_EXPIRE_AFTER).catch((ex) => {
            log.warn("Failed to set expiry time on as.completed_transactions", ex);
        });
    }

    public setSyncToken(token: string|null){
        if (token === null) {
            this.redis.del(BOT_SYNC_TOKEN_KEY + this.contextSuffix);
        } else {
            this.redis.set(BOT_SYNC_TOKEN_KEY + this.contextSuffix, token);
        }
    }

    public getSyncToken() {
        return this.redis.get(BOT_SYNC_TOKEN_KEY + this.contextSuffix);
    }

    public setFilter(filter: IFilterInfo) {
        this.redis.set(BOT_FILTER_KEY + this.contextSuffix, JSON.stringify(filter));
    }

    public async getFilter() {
        const value = await this.redis.get(BOT_FILTER_KEY + this.contextSuffix);
        return value && JSON.parse(value);
    }

    public storeValue(key: string, value: string) {
        this.redis.set(`${BOT_VALUE_KEY}${this.contextSuffix}.${key}`, value);
    }

    public readValue(key: string) {
        return this.redis.get(`${BOT_VALUE_KEY}${this.contextSuffix}.${key}`);
    }

    public async addRegisteredUser(userId: string) {
        this.redis.sadd(REGISTERED_USERS_KEY, [userId]);
    }

    public async isUserRegistered(userId: string): Promise<boolean> {
        return (await this.redis.sismember(REGISTERED_USERS_KEY, userId)) === 1;
    }

    public async setTransactionCompleted(transactionId: string) {
        this.redis.sadd(COMPLETED_TRANSACTIONS_KEY, [transactionId]);
    }

    public async isTransactionCompleted(transactionId: string): Promise<boolean> {
        return (await this.redis.sismember(COMPLETED_TRANSACTIONS_KEY, transactionId)) === 1;
    }

    public async setGithubIssue(repo: string, issueNumber: string, data: IssuesGetResponseData, scope = "") {
        const key = `${scope}${GH_ISSUES_KEY}:${repo}/${issueNumber}`;
        await this.redis.set(key, JSON.stringify(data));
        await this.redis.expire(key, ISSUES_EXPIRE_AFTER);
    }

    public async getGithubIssue(repo: string, issueNumber: string, scope = "") {
        const res = await this.redis.get(`${scope}:${GH_ISSUES_KEY}:${repo}/${issueNumber}`);
        return res ? JSON.parse(res) : null;
    }

    public async setLastNotifCommentUrl(repo: string, issueNumber: string, url: string, scope = "") {
        const key = `${scope}${GH_ISSUES_LAST_COMMENT_KEY}:${repo}/${issueNumber}`;
        await this.redis.set(key, url);
        await this.redis.expire(key, ISSUES_LAST_COMMENT_EXPIRE_AFTER);
    }

    public async getLastNotifCommentUrl(repo: string, issueNumber: string, scope = "") {
        const res = await this.redis.get(`${scope}:${GH_ISSUES_LAST_COMMENT_KEY}:${repo}/${issueNumber}`);
        return res ? res : null;
    }

    public async setPRReviewData(repo: string, issueNumber: string, url: string, scope = "") {
        const key = `${scope}${GH_ISSUES_REVIEW_DATA_KEY}:${repo}/${issueNumber}`;
        await this.redis.set(key, url);
        await this.redis.expire(key, ISSUES_LAST_COMMENT_EXPIRE_AFTER);
    }

    public async getPRReviewData(repo: string, issueNumber: string, scope = "") {
        const res = await this.redis.get(`${scope}:${GH_ISSUES_REVIEW_DATA_KEY}:${repo}/${issueNumber}`);
        return res ? res : null;
    }
}
