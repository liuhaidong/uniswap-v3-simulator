import { useSelector, useDispatch } from 'react-redux';
import { useState, useEffect } from "react";

import styles from '../styles/modules/containers/PerpetualSimulator.module.css';
import themeProps from '../data/themeProperties.json'

// Layout //
import NavBar from "../layout/NavBar";
import SideBar from "../layout/SideBar";
import DashBoard from "../layout/DashBoard";
import PoolOverview from '../layout/perp/PoolOverview';
import StrategyOverview from '../layout/StrategyOverview';
import PoolPriceLiquidity from '../layout/PoolPriceLiquidity';
import StrategyBacktest from '../layout/StrategyBacktest';

// Components //
import Grid from "../components/Grid"

// Data //
import { poolById, poolByIds } from '../api/thegraph/uniPools'
import { perpMarkets } from '../api/thegraph/uniPerpMarkets'
import { fetchPoolData } from '../store/pool';
import { setWindowDimensions, selectWindowDimensions } from '../store/window';
import { setProtocol } from '../store/protocol';
import { perpMarketStats, perpAddresses } from '../api/perpStats';
import { setStrategyColors } from '../store/strategies';
import { setStrategyRangeColors } from '../store/strategyRanges';
import { setTokenRatioColors } from '../store/tokenRatios';
import colors from '../data/colors.json';

const PerpetualSimulator = (props) => {

//-----------------------------------------------------------------------------------------------
// WINDOW DIMENSION STATE
//-----------------------------------------------------------------------------------------------

const pageMinWidth = 1200;
const windowDim = useSelector(selectWindowDimensions);
const dispatch = useDispatch();

const handleResize = () => {
  if (window.innerWidth >= pageMinWidth) {
    dispatch(setWindowDimensions({ width: window.innerWidth, height: window.innerHeight }));
  }
};

useEffect(() => {
  handleResize();
}, []);

useEffect(() => {
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, );

//-----------------------------------------------------------------------------------------------
// Set CHART COLORS ON LOAD //
//-----------------------------------------------------------------------------------------------

useEffect(() => {
  dispatch(setStrategyColors("perpetual"));
  dispatch(setStrategyRangeColors("perpetual"));
  dispatch(setTokenRatioColors("perpetual"));
  
  const docEl = document.documentElement;
  docEl.style.setProperty("--font-color", "#0E1415");
}, []);


//-----------------------------------------------------------------------------------------------
// GET DEFAULT POOL ON LOAD 
//-----------------------------------------------------------------------------------------------

useEffect(() => {

  dispatch(setProtocol({id: 1}));
  const abortController = new AbortController();

  poolById("0xf993cc412edf1257f3e771bb744645daf4c19b14", abortController.signal, 1).then( pool => {
    if (pool) {
      dispatch(fetchPoolData({...pool, protocol: 1, toggleBase: true}));
    }
    
  });

  return () => abortController.abort();

}, []);

// --------------------------------------------------------------------------------------------
// FETCH POOL DATA FOR SEARCH 
// --------------------------------------------------------------------------------------------

const [searchData, setSearchData] = useState();
const [enrichedSearchData, setEnrichedSearchData] = useState();
const [perpMarketData, setPerpMarketData] = useState();
const [perpStatsData, setPerpStatsData] = useState();
const [perpAddressList, setPerpAddressList] = useState();

useEffect(() => {

  const abortController = new AbortController();

  perpMarkets(abortController.signal).then( markets => {

    if (markets && markets[0] && markets[0].pool) {
      setPerpMarketData(markets);
      const pools = markets.map( d => d.pool );
      
      poolByIds(pools, abortController.signal, 1).then( pools => {

        if (pools && pools.length && pools.length > 0) {

          const tempSearchData = pools.map( p => {
            const tvl = markets.find( m => m.pool === p.id); 
            p.totalValueLockedUSD = tvl.quoteAmount;
            p.feeTier = 1000;
            p.poolDayData[0].volumeUSD = p.poolDayData[0].volumeToken1;
            p.poolDayData[0].feesUSD = parseFloat(p.poolDayData[0].volumeToken1) * 0.001;
            return p
          });

          setSearchData(tempSearchData);
        }
        
      });
    }
  });

  return () => abortController.abort();

}, []);

const enrichSearchData = (searchData, perpStatsData) => {

  if (searchData && searchData.length && perpStatsData && perpStatsData.length) {

    return searchData.map( d => {

      const stats = perpStatsData.find( f => f.marketSymbol === `${d.token0.symbol}/${d.token1.symbol}`);

      return stats ? {...d, lowerBaseApr: stats.lowerBaseApr, lowerRewardApr: stats.lowerRewardApr, upperBaseApr: stats.upperBaseApr, upperRewardApr: stats.upperRewardApr} :
      {...d, lowerBaseApr: 0, lowerRewardApr: 0, upperBaseApr: 0, upperRewardApr: 0}

    }).sort((a, b) => { return parseFloat(a["lowerBaseApr"]) > parseFloat(b["lowerBaseApr"]) ? -1 : 1; });
          
  } else {
    return searchData;
  }
}

useEffect(() => {

  perpMarketStats().then( pS => {
    setPerpStatsData(pS);
  });

  perpAddresses().then( pA => {
    setPerpAddressList(pA);
  });

}, []);

useEffect(() => {
  if (searchData && searchData.length) {
    setEnrichedSearchData(enrichSearchData(searchData, perpStatsData));
  }
  
}, [perpStatsData, searchData])

//---------------------------------------------------------
// Custom search for perp
//---------------------------------------------------------

const handleSearch = (searchTerm) => {

  const searchStringIsAnId = (searchString) => searchString.length && searchString.length === 42 && searchString.startsWith('0x');
  const searchStringIsValid = (searchString) => searchString.trim() && typeof(searchString) === 'string' && searchString.trim().length > 0;

  if (searchStringIsAnId(searchTerm)) {

    return enrichedSearchData.find( sd => sd.id === searchTerm);
  }
  if (searchStringIsValid(searchTerm) && enrichedSearchData && enrichedSearchData.length) {

    const results = enrichedSearchData.filter( sd => sd.token0.symbol.toUpperCase().includes(searchTerm.toUpperCase()) || sd.token1.symbol.toUpperCase().includes(searchTerm.toUpperCase()));
    
    return results && results.length && results.length > 0 ? results : "empty";
  }
  
  if (searchTerm === "") {
    return enrichedSearchData;
  }

  return null;
}

//-----------------------------------------------------------------------------------------------
//-----------------------------------------------------------------------------------------------

  return (
    <div className={styles["App"]}>
      <div className={styles["parent-container"]}>
        <NavBar
          width={windowDim.width} minWidth={pageMinWidth}
          themeToggleHidden={true}
          title="Perpetual Liquidity Strategy Simulator"
          themeProps={themeProps.uniswap}
          pageStyle={styles}>
        </NavBar>
        <Grid className={styles["dashboard-container"]}
          rows={150} columns={62}
          cellAspectRatio={0.82} gridGap={5}
          gridWidth={windowDim.width} minWidth={pageMinWidth}
          pageStyle={styles}>
          <PoolOverview page="perpetual" pageStyle={styles} colors={colors["perpetual"]} poolStatsHidden={true} markets={perpMarketData} addresses={perpAddressList} stats={perpStatsData}></PoolOverview>
          <StrategyOverview page="perpetual" pageStyle={styles} chartDataOverride="leveraged" strategies={['S1', 'S2']}
            impLossHidden={true} zeroLine={true} extendedHoverData={true}> 
          </StrategyOverview>
          <PoolPriceLiquidity page="perpetual" pageStyle={styles}></PoolPriceLiquidity>
          <StrategyBacktest page="perpetual" pageStyle={styles} customFeeDivisor={3} supressIndicatorFields={['assetval', 'total', 'token0Fee', 'token1Fee']} amountKey={"amountTR"}
          totalReturnKeys={[{ key: 'amountTR', name: "Amount", selected: true, color: "rgb(238, 175, 246)" }, {key: 'feeAcc', name: "Fee", selected: true, color: "rgb(249, 193, 160)"}]}></StrategyBacktest>
          <SideBar page="perpetual" pageStyle={styles} width={windowDim.width} minWidth={pageMinWidth} baseTokenHidden={true} protocols={[4]}
           strategies={['S1', 'S2']}
           customSearch={handleSearch}
           perpStatsData={perpStatsData}>
          </SideBar>
          <DashBoard  page="perpetual" pageStyle={styles}></DashBoard>
        </Grid>
      </div>
    </div>
  )
}

export default PerpetualSimulator