import axios, {AxiosRequestConfig, AxiosResponse} from 'axios';
//import * as ReadlineSync from 'readline-sync';

const API_HOST = 'https://api.bilibili.com' ;

enum ApiList {
	getSelfInfo = '/x/space/myinfo',
	getFollows = '/x/relation/followings',
	postFollow = '/x/relation/modify',
	getBangumiList = '/x/space/bangumi/follow/list',
	postAddBangumi = '/pgc/web/follow/add',
	postVideoHeartBeat = '/x/click-interface/web/heartbeat',
	getCreatedFolderList = '/x/v3/fav/folder/created/list-all',
	postCreateFolder = '/x/v3/fav/folder/add',
	getFolderVideoList = '/x/v3/fav/resource/list',
	getWatchHistory = '/x/web-interface/history/cursor'
}

interface FollowPostParams {
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

interface GetFollowsParams {
	vmid: number;
	pn?: number;
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
	privac: number;	 // 0 公开 1 私人
	cover?: string;
	csrf: string;
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

		

	}

	public async run() {

	}

}

class BiliAccount {
	private cookies: string;
	private csrf: string;

	constructor(cookies: string) {
		try {
			this.cookies = cookies;
			this.csrf = cookies.match(/bili_jct=(.*?);/)[1];
			this.getUserInfo().then(response => {
				let name : string = response['data']['name'];
				logger(`用户: ${name}\n`)
			})
		} catch (e) {
			logger('登录失败, 请检查cookies 是否正确')
			logger(e)
		}
	}

	private axios(options: AxiosRequestConfig): Promise<AxiosResponse> {
		options.headers = {};
		options.headers['Cookie'] = this.cookies;
		options.baseURL = API_HOST;
		return axios(options);
	}

	public async getUserInfo(): Promise<object> {
		let user_info : object = await this.axios({
			method: 'GET',
			url: ApiList.getSelfInfo,
		}).then(response => {
			return response.data;;
		})

		console.log(user_info);
		return user_info;
	}

	public async getFollows(pn: number){

	}
}

function logger(msg: string) {
	console.log(msg);
}

//main
(async () : Promise<void> => {
	let Account : BiliAccount[] = [];
	
	let copy_cookies: string = "Cookie: _uuid=3068BFED-3752-2BAC-9320-DC677D9CA4D920118infoc; buvid3=B446E90B-ABC9-4D31-846A-DE3996D7050353930infoc; CURRENT_FNVAL=16; sid=iee9usok; PVID=1; rpdid=|(J~JYR~|u~)0J'ulmku|lYl|; DedeUserID=415983021; DedeUserID__ckMd5=24f94a497395e2c1; SESSDATA=5e96f1c6%2C1609587040%2C8d29b*71; bili_jct=89f221b8fed233287462c81ab85e2731; bp_t_offset_415983021=242601721641167218; bp_video_offset_415983021=411342916458700199; LIVE_BUVID=AUTO4615947037875068"//ReadlineSync.question("需要复制的账户cookies: \n");
	Account[0] = new BiliAccount(copy_cookies);

	let paste_cookies: string = "Cookie: _uuid=3068BFED-3752-2BAC-9320-DC677D9CA4D920118infoc; buvid3=B446E90B-ABC9-4D31-846A-DE3996D7050353930infoc; CURRENT_FNVAL=16; sid=iee9usok; PVID=1; rpdid=|(J~JYR~|u~)0J'ulmku|lYl|; DedeUserID=415983021; DedeUserID__ckMd5=24f94a497395e2c1; SESSDATA=5e96f1c6%2C1609587040%2C8d29b*71; bili_jct=89f221b8fed233287462c81ab85e2731; bp_t_offset_415983021=242601721641167218; bp_video_offset_415983021=411342916458700199; LIVE_BUVID=AUTO4615947037875068"//ReadlineSync.question("需要粘贴的账户cookies: \n");
	Account[1] = new BiliAccount(paste_cookies);

	const Copy : BiliAccountCopy = new BiliAccountCopy(Account[0], Account[1]);

})().catch(e => {
	console.log(e);
})
