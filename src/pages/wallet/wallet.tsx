import React, { useEffect, useState, useRef } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import './wallet.less';
import 'antd/dist/antd.css';
import { Layout, Space, Spin, Table, Typography, Tag, AutoComplete } from 'antd';
import Icon, { CheckOutlined, LoadingOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import {
  sessionState,
  walletAssetState,
  walletListState,
  validatorListState,
  fetchingDBState,
  nftListState,
} from '../../recoil/atom';
import { Session } from '../../models/Session';
import { walletService } from '../../service/WalletService';
import { LEDGER_WALLET_TYPE, NORMAL_WALLET_TYPE } from '../../service/LedgerService';
import { AnalyticsService } from '../../service/analytics/AnalyticsService';
import { DefaultWalletConfigs } from '../../config/StaticConfig';
import IconLedger from '../../svg/IconLedger';
import IconWallet from '../../svg/IconWallet';

const { Header, Content, Footer } = Layout;
const { Text } = Typography;

enum sortOrder {
  asc = 'ascend',
  desc = 'descend',
}

function WalletPage() {
  const [session, setSession] = useRecoilState<Session>(sessionState);
  const [userAsset, setUserAsset] = useRecoilState(walletAssetState);
  const [validatorList, setValidatorList] = useRecoilState(validatorListState);
  const [nftList, setNftList] = useRecoilState(nftListState);
  const fetchingDB = useRecoilValue(fetchingDBState);
  const walletList = useRecoilValue(walletListState);
  const [loading, setLoading] = useState(false);
  const [processedWalletList, setProcessedWalletList] = useState([]);
  const didMountRef = useRef(false);

  const analyticsService = new AnalyticsService(session);

  const [t] = useTranslation();

  const processWalletList = wallets => {
    const list = wallets.reduce((resultList, wallet, idx) => {
      const walletModel = {
        ...wallet,
        key: `${idx}`,
      };
      if (wallet.identifier !== session.wallet.identifier) {
        resultList.push(walletModel);
      }
      return resultList;
    }, []);

    return list;
  };

  const processNetworkTag = (network, selectedWallet) => {
    let networkColor;

    switch (network) {
      case DefaultWalletConfigs.MainNetConfig.name:
        networkColor = 'success';
        break;
      case DefaultWalletConfigs.TestNetConfig.name:
        networkColor = 'error';
        break;
      case DefaultWalletConfigs.TestNetCroeseid3.name:
        networkColor = 'error';
        break;
      default:
        networkColor = 'default';
    }
    return (
      <Tag
        style={{ border: 'none', padding: '5px 14px', fontSize: selectedWallet ? '14px' : '12px' }}
        color={networkColor}
      >
        {network}
      </Tag>
    );
  };

  const walletSelect = async e => {
    setLoading(true);

    await walletService.setCurrentSession(new Session(walletList[e.key]));
    const currentSession = await walletService.retrieveCurrentSession();
    const currentAsset = await walletService.retrieveDefaultWalletAsset(currentSession);
    const currentNftList = await walletService.retrieveNFTs(currentSession.wallet.identifier);
    setSession(currentSession);
    setUserAsset(currentAsset);
    setNftList(currentNftList);
    await walletService.syncAll(currentSession);
    const currentValidatorList = await walletService.retrieveTopValidators(
      currentSession.wallet.config.network.chainId,
    );
    setValidatorList(currentValidatorList);

    setLoading(false);
  };

  const onSearch = value => {
    const newWalletList = walletList.filter(wallet => {
      return (
        wallet.name.toLowerCase().indexOf(value.toLowerCase()) !== -1 ||
        wallet.address.toLowerCase().indexOf(value.toLowerCase()) !== -1 ||
        value === ''
      );
    });
    setProcessedWalletList(processWalletList(newWalletList));
  };

  useEffect(() => {
    const syncWalletList = () => {
      const wallets = processWalletList(walletList);
      setProcessedWalletList(wallets);
    };

    syncWalletList();

    if (!didMountRef.current) {
      didMountRef.current = true;
      analyticsService.logPage('Wallet');
    }
  }, [fetchingDB, userAsset, nftList, validatorList]);

  const columns = [
    {
      title: t('wallet.table1.name'),
      dataIndex: 'name',
      key: 'name',
      children: [
        {
          title: session?.wallet.name,
          dataIndex: 'name',
          sortDirections: [],
          sorter: (a, b) => a.name.localeCompare(b.name),
          defaultSortOrder: sortOrder.asc,
        },
      ],
      defaultSortOrder: sortOrder.asc,
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: t('wallet.table1.address'),
      dataIndex: 'address',
      key: 'address',
      children: [
        {
          title: session?.wallet.address,
          dataIndex: 'address',
        },
      ],
      render: text => <Text type="success">{text}</Text>,
    },
    {
      title: t('wallet.table1.walletType'),
      dataIndex: 'walletType',
      key: 'walletType',
      children: [
        {
          // Old wallets (Before Ledger support ) did not have a wallet type property on creation : So they would crash on this level
          title:
            session?.wallet.walletType && session?.wallet.walletType.length > 2 ? (
              <>
                {session?.wallet.walletType.charAt(0).toUpperCase() +
                  session?.wallet.walletType.slice(1)}{' '}
                {session?.wallet.walletType === LEDGER_WALLET_TYPE ? (
                  <Icon component={IconLedger} />
                ) : (
                  <Icon component={IconWallet} />
                )}
              </>
            ) : (
              <>
                {NORMAL_WALLET_TYPE} <Icon component={IconWallet} />
              </>
            ),
          dataIndex: 'walletType',
          // Same as title above
          render: walletType =>
            walletType && walletType.length > 2 ? (
              <>
                {walletType.charAt(0).toUpperCase() + walletType.slice(1)}{' '}
                {walletType === LEDGER_WALLET_TYPE ? (
                  <Icon component={IconLedger} />
                ) : (
                  <Icon component={IconWallet} />
                )}
              </>
            ) : (
              <>
                {NORMAL_WALLET_TYPE} <Icon component={IconWallet} />
              </>
            ),
        },
      ],
    },
    {
      title: t('wallet.table1.network'),
      key: 'network',
      children: [
        {
          title: processNetworkTag(session?.wallet.config.name, true),
          render: record => {
            return processNetworkTag(record.config.name, false);
          },
        },
      ],
      sorter: (a, b) => a.config.name.localeCompare(b.config.name),
    },
    {
      title: t('general.action'),
      key: 'action',
      children: [
        {
          title: (
            <CheckOutlined
              style={{
                fontSize: '22px',
                color: '#1199fa',
                position: 'absolute',
                top: '20px',
              }}
            />
          ),
          render: record => {
            return (
              <Space size="middle">
                <a
                  onClick={() => {
                    walletSelect(record);
                  }}
                >
                  {t('general.select')}
                </a>
              </Space>
            );
          },
        },
      ],
    },
  ];

  return (
    <Layout className="site-layout">
      <Header className="site-layout-background">{t('wallet.title')}</Header>
      <div className="header-description">{t('wallet.description')}</div>
      <Content>
        <div className="site-layout-background wallet-content">
          <div className="container">
            <div className="item">
              <AutoComplete
                style={{ width: 400 }}
                onSearch={onSearch}
                placeholder={t('wallet.search.placeholder')}
              />
            </div>
            <Table
              dataSource={processedWalletList}
              columns={columns}
              loading={{
                indicator: <Spin indicator={<LoadingOutlined style={{ fontSize: 36 }} spin />} />,
                spinning: loading,
              }}
            />
          </div>
        </div>
      </Content>
      <Footer />
    </Layout>
  );
}

export default WalletPage;
