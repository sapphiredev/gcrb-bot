import IORedis from 'ioredis';

import {
	Item,
} from '~/models';

import {
	equals,
} from '~/helpers';

export class Database {
	private readonly redis: IORedis.Redis;

	public constructor() {
		this.redis = new IORedis();
	}

	public key(id: string) {
		return `gcrb_bot:${id}`;
	}

	public async getItem(id: string): Promise<Item | null> {
		const key = this.key(id);
		const res = await this.redis.get(key);

		if (res === null) {
			return null;
		}
		try {
			const item = JSON.parse(res);
			return item;
		}
		catch {
			return null;
		}
	}

	public async insertItem(nextItem: Item): Promise<boolean> {
		const id = nextItem.id;

		const prevItem = await this.getItem(id);
		if (prevItem === null || equals(prevItem, nextItem)) {
			return true;
		}

		{
			const key = this.key(id);
			const value = JSON.stringify(nextItem);
			const res = await this.redis.set(key, value, 'EX', 7 * 24 * 3600);
			if (res !== 'OK') {
				return false;
			}
		}
		{
			const key = this.key('index');
			if (nextItem.tweet === 0) {
				const res = await this.redis.sadd(key, id);
				console.log('sadd', res);
			}
			else {
				const res = await this.redis.srem(key, id);
				console.log('srem', res);
			}
			return true;
		}
	}

	public async getUntweetedItems(platform: number): Promise<Item[]> {
		const key = this.key('index');
		const ids: string[] = await this.redis.smembers(key);
		const promises = ids.map(id => this.getItem(id));
		const items = await Promise.all(promises);
		return items.filter((x): x is Item => x !== null).filter(x => x.platform === platform);
	}
}
