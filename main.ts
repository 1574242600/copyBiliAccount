import axios, {AxiosRequestConfig, AxiosResponse} from 'axios';
//import * as ReadlineSync from 'readline-sync';

const API_HOST = 'https://api.bilibili.com' ;

enum ApiList {
	getSelfInfo = '/x/space/myinfo',
	getFollowsList = '/x/relation/followings',
	postAddFollow = '/x/relation/modify',
	getBangumiList = '/x/space/bangumi/follow/list',
	postAddBangumi = '/pgc/web/follow/add',
	postVideoHeartBeat = '/x/click-interface/web/heartbeat',
	getCreatedFolderList = '/x/v3/fav/folder/created/list-all',
	postCreateFolder = '/x/v3/fav/folder/add',
	getFolderVideoList = '/x/v3/fav/resource/list',
	getWatchHistory = '/x/web-interface/history/cursor'
}

interface AddFollowPostParams {
	fid: number; // 被关注人uid
	act: number;  // 1 关注  2取关
	re_src: number;
	jsonp?: string;	 
	csrf: string;
}

interface BangumiListGetParams {
	type: number;  // 1 返回全部信息 2 只返回页数
	follow_status?: string;
	ps?: number;
	pn: number; // 当前页码
	vmid: number; // 用户uid
}

interface FollowsListGetParams {
	vmid: number;
	pn?: number;
	ps?: number; // 列表长度, 默认且最高50
	jsonp?: string;
}

interface AddBangumiPostParams {
	season_id: number;	//番剧sid
	csrf: string;
}

interface VideoHeartBeatPostParams {
	aid: number;
	cid: number;
	bvid: string;
	mid: number;
	csrf: string;
	played_time: number;
	real_played_time: number;
	realtime: number;
	start_ts?: number;
	type?: number;		// 视频 3  番剧 4 （需要epid 和 sid）
	dt?: number;
	play_type?: number;
	sub_type?: number;
	epid?: number;
	sid?: number;
}

interface CreatedFolderListGetParams {
	up_mid: number;
	jsonp?: string;
}

interface CreateFolderPostParams {
	title: string;
	intro: string;
	privac: 0 | 1;	 // 0 公开 1 私人
	cover?: string;
	csrf: string;
}

interface FolderVideoListGetParams {
	media_id: number;
	pn: number;
	ps: number;	// 列表长度, 默认15, 最高50
	keyword?: string; //搜索
	order?: string;
	type?: number;
	tid?: number;
	jsonp?: string;
}

interface WatchHistoryGetParams {
	max: number;
	view_at: number;
	business?: string;
}

class BiliAccountCopy {
	private copy: BiliAccount;
	private to_paste: BiliAccount;

	constructor(copy: BiliAccount, to_paste: BiliAccount) {
		this.copy = copy;
		this.to_paste = to_paste;
		//this.copyBangumiList();
	}

	public async run() {
		let async_list: Promise<void>[] = [];
		async_list.push(this.copyFollowsList());
		async_list.push(this.copyBangumiList());
		async_list.push((async (): Promise<void> => {

		})())
	}

	private async copyFollowsList(){
		const follows_list: (object[]|number)[] = await (async (ps) => {

			let follows_list: object[] = [];
			let i: number = 1;
			let total: number;

			do {
				let data: object = await this.copy.getFollowsList(i);
				total = data['total'];

				follows_list.unshift(
					...(
						data['list'].map((v: Array<object>) => {
							return {
								mid: v['mid'],
								uname: v['uname'],
							};
						})
					)
				)

				i++;
			} while (follows_list.length !== total)

			return [follows_list, total];
		})()

		Promise.all((<object[]>follows_list[0]).map(v => {
			return (async () => {
				await this.to_paste.postAddFollow(v['mid']);
				logger(`复制关注: ${v['uname']} 成功`)
			})();
		})).then( _ => {
			logger(`共复制关注 ${follows_list[2]} 个`)
		})
	}

	private async copyBangumiList(){
		const bangumi_list: (object[]|number)[] = await (async () => {
			let bangumi_list: object[] = [];
			let i: number= 1;
			let total_pages: number = 0;

			do {
				let data = await this.copy.getBangumiList(i);
				total_pages = data['total'];

				bangumi_list.unshift(
					...(
						data['list'].map((v: Array<object>) => {
							return {
								season_id: v['season_id'],
								title: v['title'],
							};
						})
					)
				)

				i++;
			} while ((i - 1) * 50 < total_pages )
			return [bangumi_list, total_pages];
		})();

		Promise.all((<object[]>bangumi_list[0]).map(v => {
			return (async () => {
				await this.to_paste.postAddBangumi(v['season_id']);
				logger(`复制追番: ${v['uname']} 成功`)
			})();
		})).then( _ => {
			logger(`共复制追番 ${bangumi_list[2]} 个`)
		})
	}

	private async copyCreatedFolderList() :object[] {

	}
}

class BiliAccount {
	private cookies: string;
	private csrf: string;
	private user_info : object;

	constructor(cookies: string) {
		this.cookies = cookies;
		this.csrf = cookies.match(/bili_jct=(.*?);/)[1];
	}

	private axios(options: AxiosRequestConfig): Promise<AxiosResponse> {
		options.headers = {};

		if(options.method == 'POST') {
			options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
			options.data = this.postDataToString(options.data);
		}

		options.headers['Referer'] = 'https://www.bilibili.com/';
		options.headers['Cookie'] = this.cookies;
		options.baseURL = API_HOST;

	
		options.proxy =  {
			host: '127.0.0.1',
			port: 1084,
		};
	
		
		return axios(options).then(response => {
			if ((response.data)['code'] !== 0) throw '请求错误: \n' + JSON.stringify(response.data);
			return response;
		});
	}

	public async init(): Promise<void> {
		await this.getUserInfo().then(response => {
			let name : string = response['name'];
			if(name === undefined) throw response;
			this.user_info = response;
			logger(`用户: ${name}\n`)
		}).catch(e => {
			logger('登录失败, 请检查cookies 是否正确')
			logger(e)
		})
	}

	private postDataToString(data: object): string {
		let arr: string[] = [];

		for (let i in data){
			arr.push(`${i}=${data[i]}`)
		}

		return arr.join('&');
	}

	public async getUserInfo(): Promise<object> {
		return await this.axios({
			method: 'GET',
			url: ApiList.getSelfInfo,
		}).then(response => {
			return (response.data)['data'];
		});
	}

	public async getFollowsList(pn: number = 0){
		let params: FollowsListGetParams = {
			vmid: this.user_info['mid'],
			pn: pn
		}

		return await this.axios({
			method: 'GET',
			params: params,
			url: ApiList.getFollowsList,
		}).then(response => {
			return (response.data)['data'];
		})
	}

	public async getBangumiList(pn: number = 1): Promise<object> {
		let params: BangumiListGetParams = {
			vmid: this.user_info['mid'],
			type: 1,
			pn: pn,
			ps: 50
		}

		return await this.axios({
			method: 'GET',
			params: params,
			url: ApiList.getBangumiList,
		}).then(response => {
			return (response.data)['data'];
		});
	}

	public async getCreatedFolderList(): Promise<object> {
		let params: CreatedFolderListGetParams = {
			up_mid: this.user_info['mid'],
			jsonp: 'json'
		}

		return await this.axios({
			method: 'GET',
			params: params,
			url: ApiList.getCreatedFolderList,
		}).then(response => {
			return (response.data)['data'];
		})
	}

	public async getFolderVideoList(media_id: number): Promise<object>{
		let params: FolderVideoListGetParams = {
			media_id: media_id,
			pn: 1,
			ps: 50
		}

		return await this.axios({
			method: 'GET',
			params: params,
			url: ApiList.getFolderVideoList,
		}).then(response => {
			return (response.data)['data'];
		})
	}

	public async getWatchHistory(max: number, view_at: number, business: string): Promise<object> {
		let params: WatchHistoryGetParams = {
			max: max,
			view_at: view_at,
			business: business
		}

		return await this.axios({
			method: 'GET',
			params: params,
			url: ApiList.getWatchHistory
		}).then(response => {
			return (response.data)['data'];
		});
	}

	public async postAddFollow(fid: number): Promise<void> {
		let data: AddFollowPostParams = {
			fid: fid,
			act: 1,
			re_src: 11,
			csrf: this.csrf,
		}

		await this.axios({
			method: 'POST',
			data: data,
			url: ApiList.postAddFollow,
		})
	}

	public async postAddBangumi(season_id: number): Promise<void> {
		let data: AddBangumiPostParams = {
			season_id: season_id,
			csrf: this.csrf
		}

		await this.axios({
			method: 'POST',
			data: data,
			url: ApiList.postAddBangumi,
		})
	}

	public async postCreateFolder(title: string, intro: string, privac: 0 | 1): Promise<object> {
		let data: CreateFolderPostParams = {
			title: title,
			intro: intro,
			privac: privac,
			csrf: this.csrf
		}

		return await this.axios({
			method: 'POST',
			data: data,
			url: ApiList.postCreateFolder,
		}).then(response => {
			return (response.data)['data'];
		})
	}

	public async VideoHeartBeatPostParams(data: VideoHeartBeatPostParams): Promise<void> {
		await this.axios({
			method: 'POST',
			data: data,
			url: ApiList.postCreateFolder,
		})
	}

}

function logger(msg: string) {
	console.log(msg);
}

//main
(async () : Promise<void> => {
	let Account : BiliAccount[] = [];
	
	let copy_cookies: string = "buvid3=D58AEEDD-FF2D-4325-8AE1-FB25AB2415DA40958infoc; sid=cy23zr87; _uuid=68494407-C3AA-CE0E-2DF7-FC06E823D98D72415infoc; CURRENT_FNVAL=16; DedeUserID=27710126; DedeUserID__ckMd5=e5a0de56adfeac2d; SESSDATA=8b16b5a2%2C1610348859%2C3a4a1*71; bili_jct=4e72fb7961b8c592469ade52707d94dc; PVID=2"//ReadlineSync.question("需要复制的账户cookies: \n");
	Account[0] = new BiliAccount(copy_cookies);
	await Account[0].init()

	//console.log(await Account[0].getWatchHistory(0,0,''));

	let paste_cookies: string = "_uuid=3068BFED-3752-2BAC-9320-DC677D9CA4D920118infoc; buvid3=B446E90B-ABC9-4D31-846A-DE3996D7050353930infoc; CURRENT_FNVAL=16; sid=iee9usok; PVID=1; rpdid=|(J~JYR~|u~)0J'ulmku|lYl|; DedeUserID=415983021; DedeUserID__ckMd5=24f94a497395e2c1; SESSDATA=5e96f1c6%2C1609587040%2C8d29b*71; bili_jct=89f221b8fed233287462c81ab85e2731; bp_t_offset_415983021=242601721641167218; bp_video_offset_415983021=411342916458700199; LIVE_BUVID=AUTO4615947037875068"//ReadlineSync.question("需要粘贴的账户cookies: \n");
	Account[1] = new BiliAccount(paste_cookies);
	await Account[1].init()

	const Copy : BiliAccountCopy = new BiliAccountCopy(Account[0], Account[1]);


})().catch(e => {
	console.log(e);
})