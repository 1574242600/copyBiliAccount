import axios, {AxiosRequestConfig, AxiosResponse} from 'axios';
import * as ReadlineSync from 'readline-sync';

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
    postVideoToFolder = '/x/v3/fav/resource/deal',
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
    mid?: number;
    csrf?: string;
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
    privacy: 0 | 1;	 // 0 公开 1 私人
    cover?: string;
    csrf: string;
}

interface VideoToFolderPostPatams {
    rid: number; // av号
    type: number;
    add_media_ids?: string | number;
    del_media_ids?: string | number;
    jsonp: string;
    csrf: string;
}

interface FolderVideoListGetParams {
    media_id: number;
    pn: number;
    ps: number;	// 列表长度, 默认且最高20
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
    }

    public async run() {
        let async_list: (() => Promise<void>)[] = [];


        async_list.push((async () => {
            let bangumi_list = await this.copyBangumiList()
            await this.copygetBangumiLastTime(bangumi_list);
        }));

        async_list.push((async () => {
            let folder_info: object = await this.copyCreatedFolderList()
            await this.copyFolderVideoList(folder_info);
        }))

        async_list.push((async () => {await this.copyFollowsList()}));
        async_list.push((async () => {await this.copyWatchHistory()}));


        this.all(async_list, 1).then( _ => {
            logger('复制完成')
        })
    }

    //TODO: 测试最高请求速率
    /**
     * 按顺序执行的 Promise.all()
     * @name all
     * @param iterable (() => Promise<T>)[]
     * @param t number 单次请求数量
     * @param sleep_ms number 请求间隔时间
     */
    private async all<T = void>(iterable: (() => Promise<T>)[], t: number = 3, sleep_ms: number = 100): Promise<void | T[]>{
        let data: any[] = [];

        for (let c = 0; c < iterable.length; c = c + t){
            let temporary_async: (Promise<any>)[] = [];

            for(let i of range(0, t)){
                let index = c + i;
                if(index > iterable.length - 1) break;
                temporary_async.push(iterable[index]());
            }

            await Promise.all(temporary_async).then(list => {
                for (let v of list){
                    data.push(v);
                }
            })

            await sleep(sleep_ms);
        }

        if (data[0] !== undefined){
            return data;
        }
    }

    private async copyFollowsList(){
        const follows_list: (object[]|number)[] = await (async (ps) => {

            let follows_list: object[] = [];
            let i: number = 1;
            let total: number;

            do {
                let data: object = await this.copy.getFollowsList(i);
                total = data['total'];

                follows_list.push(
                    ...(data['list'].map((v: Array<object>) => {
                            return {
                                mid: v['mid'],
                                uname: v['uname'],
                            };
                        }))
                )

                i++;
            } while (follows_list.length !== total)

            return [follows_list.reverse(), total];
        })()


        await this.all((<object[]>follows_list[0]).map(v => {
            return (async () => {
                await this.to_paste.postAddFollow(v['mid']);
                logger(`复制关注: ${v['uname']} 成功`)
            });
        }), 1, 250).then( _ => {
            logger(`共复制关注 ${follows_list[1]} 个`)
        })
    }

    private async copyBangumiList(): Promise<object[]> {
        const bangumi_list: (object[]|number)[] = await (async () => {
            let bangumi_list: object[] = [];
            let i: number= 1;
            let total_pages: number = 0;

            do {
                let data = await this.copy.getBangumiList(i);
                total_pages = data['total'];

                bangumi_list.push(
                    ...(data['list'].map((v: object[]) => {
                        return {
                            season_id: v['season_id'],
                            title: v['title'],
                        };
                    }))
                )
                
                i++;
            } while ((i - 1) * 50 < total_pages )
            return [bangumi_list.reverse(), total_pages];
        })();

        await this.all((<object[]>bangumi_list[0]).map(v => {
            return (async () => {
                await this.to_paste.postAddBangumi(v['season_id']);
                logger(`复制追番: ${v['title']} 成功`)
            });
        })).then( _ => {
            logger(`共复制追番 ${bangumi_list[1]} 个`)
        })

        return <object[]>bangumi_list[0];
    }

    private async copygetBangumiLastTime(bangumi_list: object[]) {
        let total: number = 0;
        await this.all(bangumi_list.map(v => {
            return (async () => {
                let last_time_info: object | undefined = await this.copy.getBangumiLastTimeInfo(v['season_id'])
                if(last_time_info === undefined) return 0;
                let data: VideoHeartBeatPostParams = {
                    aid: last_time_info['aid'],
                    cid: last_time_info['cid'],
                    bvid: last_time_info['bvid'],
                    played_time: last_time_info['last_time'],
                    real_played_time: last_time_info['last_time'],
                    realtime: last_time_info['last_time'],
                    start_ts: Math.floor(Date.now() / 1000),
                    type:4,
                    epid: last_time_info['last_ep_id'],
                    sid: v['season_id']
                }

                await this.to_paste.postVideoHeartBeat(data);
                total++;
                logger(`复制番剧观看进度: ${v['title']} 成功`);
            })
        }))

        logger(`共复制番剧观看进度: ${total} 条`);
    }

    private async copyCreatedFolderList(): Promise<object> {
        let folder_info : object = {
            copy: [],
            to_paste: []
        };


        folder_info['copy'] = await (async (): Promise<object[]> => {
            let copy_folder: object[] = [];

            let created_folder_list = await this.copy.getCreatedFolderList();

            copy_folder.push(
                ...(created_folder_list['list'].map((v : object) => {
                    return {
                        id: v['id'],
                        title: v['title'],
                        privacy: (v['attr'] % 2) === 0 ? 0 : 1
                    }
                }))
            );

            return copy_folder;
        })()


        folder_info['to_paste'] = await (async (): Promise<object[]> =>{
            let to_paste_folder: object[] = [];

            to_paste_folder.push(await (async ()=> {
                let _default = (await this.to_paste.getCreatedFolderList())['list'][0];
                return {
                    id: _default['id'],
                }
            })())	//默认收藏夹

            await this.all((<object[]>folder_info['copy']).map(v => {
                return (async () => {
                    if (v['title'] === '默认收藏夹') return 0;	//忽略默认收藏夹
                    to_paste_folder.push(await this.to_paste.postCreateFolder(v['title'], '', v['privacy']));
                    logger(`复制收藏夹: ${v['title']} 成功`)
                });
            }), 1).then( _ => {
                logger(`共复制收藏夹 ${(folder_info['copy'].length - 1)} 个`)
            })	//氦，我居然忘了这玩意是异步，结果就是收藏夹对不上，debug半天

            return to_paste_folder.map(v => {
                return {
                    id: v['id'],
                    // title: v['title']	调试
                };
            });
        })()


        return folder_info;
    }

    private async copyFolderVideoList(folder_info: object): Promise<void> {
        let copy: object[] = folder_info['copy'];
        let to_paste: object[] = folder_info['to_paste'];
        let _total: number = 0;

        for (let count in copy) {
            let total: number;

            let video_list: object[] = await (async () => {
                let video_list: object[] = [];
                let i: number = 1; //页码
                do {
                    await sleep(100);

                    let temporary_video_list_info: object = (await this.copy.getFolderVideoList(copy[count]['id'], i));
                    let temporary_video_list = temporary_video_list_info['medias'];
                    total = temporary_video_list_info['info']['media_count'];

                    video_list.push(
                        ...(temporary_video_list.map((v: object)=> {
                            return {
                                id: v['id'],
                                title: v['title'],
                                type: v['type']
                            }
                        }))
                    );

                    i++;
                } while ((i - 1) * 20 < total)

                return video_list.reverse();
            })()

            await this.all((video_list.map(v => {
                let mid: number = to_paste[count]['id'];
                return (async () => {
                    await this.to_paste.postVideoToFolder(v['id'], mid, v['type']);
                    _total++;
                    logger(`复制视频到收藏夹[${mid}]: ${v['title']} (av${v['id']})`);
                })
            })), 1, 200)
        }

        logger(`共复制视频到收藏夹 ${_total}个`)
    }

    private async copyWatchHistory(){
        let history_list: object[] = await (async ()=> {
            let history_list: object[] = [];
            let params: WatchHistoryGetParams = {
                max: 0,
                view_at: 0,
                business: ''
            }

            while (true) {
                let temporary_history: object = await this.copy.getWatchHistory(params);
                if(temporary_history['list'].length === 0) break;
                delete temporary_history['cursor']['ps'];
                params = temporary_history['cursor']
                history_list.push(...temporary_history['list']);
            }

            return history_list;
        })()

        await this.all((history_list.map(v => {
            let is_fan: boolean = v['badge'] === '番剧';

            let data: VideoHeartBeatPostParams = {
                aid: v['history']['oid'],
                cid: v['history']['cid'],
                bvid: avToBV(v['history']['oid']),
                start_ts: v['view_at'],
                played_time: v['progress'],
                real_played_time: v['progress'],
                realtime: v['progress'],
                type: is_fan ? 4 : 3,
                epid: is_fan ? v['history']['epid'] : undefined,
                sid: is_fan ? v['history']['sid'] : undefined
            }

            return (async () => {
                await this.to_paste.postVideoHeartBeat(data);
                logger(`复制历史记录: ${v['title']} 成功`);
            })
        })))

        logger(`共复制历史记录: ${history_list.length}条`);
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

    private axios(options: AxiosRequestConfig, is_api: number = 1): Promise<AxiosResponse> {
        options.headers = {};

        if(options.method == 'POST') {
            options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
            options.data = this.postDataToString(options.data);
        }

        options.headers['Referer'] = 'https://www.bilibili.com/';
        options.headers['Cookie'] = this.cookies;
        options.baseURL = API_HOST;

        /*
        options.proxy =  {
            host: '127.0.0.1',
            port: 1084,
        };
        */

        return axios(options).then(response => {
            if (is_api && (response.data)['code'] !== 0) throw '请求错误: \n' + JSON.stringify(response.data);
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

    /**
     * 对象转 post 字符串
     * @name postDataToString
     * @param data object
     * @return string
     */
    private postDataToString(data: object): string {
        let arr: string[] = [];

        for (let i in data){
            arr.push(`${i}=${data[i]}`)
        }

        return arr.join('&');
    }

    /**
     * 获取个人信息
     * @name getUserInfo
     * @return Promise<object>
     */
    public async getUserInfo(): Promise<object> {
        return await this.axios({
            method: 'GET',
            url: ApiList.getSelfInfo,
        }).then(response => {
            return (response.data)['data'];
        });
    }

    /**
     * 获取关注列表
     * @name getFollowsList
     * @param pn number 页码
     */
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

    /**
     * 获取追番列表
     * @name getBangumiList
     * @param pn number 页码
     * @return Promise<object>
     */
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

    /**
     * 获取收藏夹列表
     * @name getCreatedFolderList
     */
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

    /**
     * 获取收藏夹视频
     * @name getFolderVideoList
     * @param media_id number 收藏夹id
     * @param pn number 页码
     * @return Promise<object>
     */
    public async getFolderVideoList(media_id: number,pn: number = 1): Promise<object>{
        let params: FolderVideoListGetParams = {
            media_id: media_id,
            pn: pn,
            ps: 20,
            order: 'mtime',
            type: 0,
            tid: 0
        }

        return await this.axios({
            method: 'GET',
            params: params,
            url: ApiList.getFolderVideoList,
        }).then(response => {
            return (response.data)['data'];
        })
    }

    /**
     * 获取历史记录
     * @name getWatchHistory
     * @param params WatchHistoryGetParams
     * @return Promise<object>
     */
    public async getWatchHistory(params: WatchHistoryGetParams): Promise<object> {
        return await this.axios({
            method: 'GET',
            params: params,
            url: ApiList.getWatchHistory
        }).then(response => {
            return (response.data)['data'];
        });
    }

    /**
     * 获取番剧观看进度信息
     * @name getBangumiLastTime
     * @param sid number 番剧sid
     * @return Promise<object | undefined>
     */

    public async getBangumiLastTimeInfo(sid: number): Promise<object | undefined> {
        return await this.axios({
            method: 'GET',
            url: `https://www.bilibili.com/bangumi/play/ss${sid}`
        }, 0).then(response => {

            let json: string = response.data.match(/{"last_ep(.*?)}/)[0];
            json = JSON.parse(json);
            if(json['last_ep_index'] < 0) return undefined;

            let aid_and_cid_list = response.data.match(/:[0-9]+,"bvid":"[a-zA-Z0-9]+","cid":[0-9]+,/g)
            response.data = undefined;

            let aid_and_cid = aid_and_cid_list[json['last_ep_index'] - 1].match(/:([0-9]+),"bvid":"([a-zA-Z0-9]+)","cid":([0-9]+),/);
            aid_and_cid_list = undefined;

            json['aid'] = aid_and_cid[1];
            json['bvid'] = aid_and_cid[2]
            json['cid'] = aid_and_cid[3];
            return json;
        }).catch( _ => {
            return undefined;
        });
    }

    /**
     * 关注
     * @name postAddFollow
     * @param fid number 用户uid
     */
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

    /**
     * 追番
     * @name postAddBangumi
     * @param season_id number 番剧sid
     */
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

    /**
     * 创建收藏夹
     * @name postCreateFolder
     * @param title string 标题
     * @param intro string 简介
     * @param privacy number  0 公开 ， 1私用
     * @return Promise<object>
     */
    public async postCreateFolder(title: string, intro: string, privacy: 0 | 1): Promise<object> {
        let data: CreateFolderPostParams = {
            title: title,
            intro: intro,
            privacy: privacy,
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

    /**
    * 心跳包 用于添加历史记录
    * @name postVideoHeartBeat
    * @param data VideoHeartBeatPostParams
    */
    public async postVideoHeartBeat(data: VideoHeartBeatPostParams): Promise<void> {
        data['csrf'] = this.csrf;
        data['mid'] = this.user_info['mid'];

        await this.axios({
            method: 'POST',
            data: data,
            url: ApiList.postVideoHeartBeat,
        })
    }

    /**
    * 收藏 视频
    * @name postVideoToFolder
    * @param rid number av号
    * @param mid number | string 收藏夹id
    */
    public async postVideoToFolder(rid: number, mid: number | string, type: number): Promise<void>{
        let data: VideoToFolderPostPatams = {
            rid: rid,
            add_media_ids: mid,
            type: type,
            jsonp: 'jsonp',
            csrf: this.csrf
        }

        await this.axios({
            method: 'POST',
            data: data,
            url: ApiList.postVideoToFolder,
        })
    }

}

function logger(msg: string) {
    console.log(msg);
}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function avToBV(av: number): string {
    let table='fZodR9XQDSUm21yCkr6zBqiveYah8bt4xsWpHnJE7jL5VG3guMTKNPAwcF';
    let tr = {};
    for (let i of range(0,58)){
        tr[table[i]] = i;
    }

    let s = [11,10,3,8,4,6];
    let xor = 177451812;
    let add = 8728348608;

    av = (av ^ xor) + add
    let r = 'BV1  4 1 7  '.split('');
    for (let i of range(0, 6)){
        r[s[i]] = table[Math.floor(av / (58 ** i)) % 58]
    }

    return r.join('');
}

function* range(start: number, end: number, step: number = 1): Generator<number> {
    for (let i = start; i < end; i += step) {
        yield i;
    }
}

//main
(async () : Promise<void> => {
    let Account : BiliAccount[] = [];

    console.log('请输入账户cookies')
    let copy_cookies: string = ReadlineSync.question("需要复制的账户: \n");
    Account[0] = new BiliAccount(copy_cookies);
    await Account[0].init()

    let paste_cookies: string = ReadlineSync.question("需要粘贴的账户: \n");
    Account[1] = new BiliAccount(paste_cookies);
    await Account[1].init()

    const Copy : BiliAccountCopy = new BiliAccountCopy(Account[0], Account[1]);
    Copy.run();

})().catch(e => {
    console.log(e);
})