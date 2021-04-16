import Web3 from 'web3';

import SuperfluidMinionAbi from '../contracts/superfluidMinion.json';
import { SUPERFLUID_MINION_STREAMS } from '../graphQL/superfluid-queries';
import { TokenService } from './tokenService';
import { chainByID, getGraphEndpoint } from '../utils/chain';
import { graphFetchAll } from '../utils/theGraph';

import SuperfluidSDK from '@superfluid-finance/js-sdk';

let sf = null;

const getSuperTokenBalances = async (chainID, minion, superTokens) => {
  const tokenBalances = superTokens.map(async (tokenAddress) => {
    const tokenService = TokenService({
      tokenAddress: tokenAddress,
      chainID,
    });
    return {
      [tokenAddress]: {
        tokenBalance: await tokenService('balanceOf')(minion),
        symbol: await tokenService('symbol')(minion),
        decimals: await tokenService('decimals')(minion),
      },
    };
  });
  return Object.assign({}, ...(await Promise.all(tokenBalances)));
};

export const SuperfluidMinionService = ({ web3, minion, chainID }) => {
  const chainConfig = chainByID(chainID);
  if (!web3) {
    const rpcUrl = chainConfig.rpc_url;
    web3 = new Web3(new Web3.providers.HttpProvider(rpcUrl));
  }

  const contract = new web3.eth.Contract(SuperfluidMinionAbi, minion);

  return function getService(service) {
    if (service === 'fetchStreams') {
      return async ({ molochAddress }) => {
        const streams = await graphFetchAll({
          endpoint: getGraphEndpoint(chainID, 'subgraph_url'),
          query: SUPERFLUID_MINION_STREAMS,
          variables: {
            minionId: `${molochAddress}-minion-${minion}`,
          },
          subfield: 'minionStreams',
        });
        if (!streams.length) {
          return {
            flows: [],
            superTokens: null,
          };
        }
        const superTokens = await getSuperTokenBalances(
          chainID,
          minion,
          Array(
            ...new Set(
              streams.filter((s) => s.executed).map((s) => s.superTokenAddress),
            ),
          ),
        );
        if (!sf) {
          // load SuperfluidSDK
          const sfVersion = chainByID(chainID).superfluid_version;
          sf = new SuperfluidSDK.Framework({
            web3: web3,
            version: sfVersion,
          });
          await sf.initialize();
        }
        const now = new Date();
        const flows = await Promise.all(
          streams.map(async (stream) => {
            if (stream.executed) {
              const decimals = superTokens[stream.superTokenAddress].decimals;
              if (stream.active) {
                // flow -> { timeStamp, flowRate, deposit, owedDeposit }
                const flow = await sf.cfa.getFlow({
                  superToken: stream.superTokenAddress,
                  sender: minion,
                  receiver: stream.to,
                });
                flow.netFlow =
                  (+flow.flowRate * ((now - flow.timestamp) / 1000)) /
                  10 ** decimals;
                return Object.assign({}, stream, flow);
              } else {
                const stContract = await sf.contracts.ISuperToken.at(
                  stream.superTokenAddress,
                );
                stream.netFlow =
                  +(await stContract.balanceOf(stream.to)).toString() /
                  10 ** decimals;
                return stream;
              }
            }
            return stream;
          }),
        );
        return {
          flows,
          superTokens,
        };
      };
    } else if (service === 'getStream') {
      return async ({ proposalId }) => {
        const action = await contract.methods.streams(proposalId).call();
        return action;
      };
    }
    // proposeAction args: [ to, token, rate, minDeposit, ctx, details ]
    // executeAction args: [ proposal id ]
    // cancelAction args: [ proposal id ]
    // cancelStream args: [ proposal id ]
    // withdrawRemainingFunds args: | superToken |
    else if (
      service === 'proposeStream' ||
      service === 'executeAction' ||
      service === 'cancelAction' ||
      service === 'cancelStream' ||
      service === 'withdrawRemainingFunds'
    ) {
      return async ({ args, address, poll, onTxHash }) => {
        const tx = await contract.methods[service](...args);
        return tx
          .send('eth_requestAccounts', { from: address })
          .on('transactionHash', (txHash) => {
            if (poll) {
              onTxHash();
              poll(txHash);
            }
          })
          .on('error', (error) => {
            console.error(error);
          });
      };
    }
  };
};
