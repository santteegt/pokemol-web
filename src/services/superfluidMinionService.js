import { constants } from 'ethers';
import Web3 from 'web3';

import SuperfluidMinionAbi from '../contracts/superfluidMinion.json';
import SuperfluidResolverAbi from '../contracts/iSuperfluidResolver.json';
import { MINION_STREAMS, SF_ACTIVE_STREAMS, SF_OUTGOING_STREAMS } from '../graphQL/superfluid-queries';
import { TokenService } from './tokenService';
import { chainByID, getGraphEndpoint } from '../utils/chain';
import { graphFetchAll } from '../utils/theGraph';
import { graphQuery } from '../utils/apollo';

const getSuperTokenBalances = async (
  chainID,
  minion,
  sfResolver,
  sfVersion,
  superTokens,
) => {
  try {
    const tokenBalances = superTokens.map(async (tokenAddress) => {
      const tokenService = TokenService({
        tokenAddress,
        chainID,
      });
      const tokenSymbol = await tokenService('symbol')();
      const sToken = await sfResolver.methods.get(
        `supertokens.${sfVersion}.${tokenSymbol}`,
      ).call();
      return {
        [tokenAddress]: {
          tokenBalance: await tokenService('balanceOf')(minion),
          symbol: tokenSymbol,
          decimals: await tokenService('decimals')(),
          registeredToken: sToken !== constants.AddressZero,
          _service: tokenService,
        },
      };
    });
    return Object.assign({}, ...(await Promise.all(tokenBalances)));
  } catch (error) {
    console.log(error);
    return null;
  }
};

export const SuperfluidMinionService = ({ web3, minion, chainID }) => {
  const chainConfig = chainByID(chainID);
  if (!web3) {
    const rpcUrl = chainConfig.rpc_url;
    web3 = new Web3(new Web3.providers.HttpProvider(rpcUrl));
  }

  const minionContract = new web3.eth.Contract(SuperfluidMinionAbi, minion);

  return function getService(service) {
    if (service === 'fetchStreams') {
      return async ({ molochAddress }) => {
        try {
          const superfluidConfig = chainConfig.superfluid;
          if (!superfluidConfig) {
            throw Error(`Superfluid minion not available in ${chainID} network`);
          }
          const sfResolver = new web3.eth.Contract(SuperfluidResolverAbi, superfluidConfig?.resolver);
          const sfVersion = superfluidConfig.version;
          const streams = await graphFetchAll({
            endpoint: getGraphEndpoint(chainID, 'subgraph_url'),
            query: MINION_STREAMS,
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

          const sfAccount = await graphQuery({
            endpoint: superfluidConfig.subgraph_url,
            query: SF_OUTGOING_STREAMS,
            variables: {
              ownerAddress: minion,
            },
          });
          const sfStreams = sfAccount?.account?.flowsOwned;

          const superTokens = await getSuperTokenBalances(
            chainID,
            minion,
            sfResolver,
            sfVersion,
            Array(
              ...new Set(
                streams.filter((s) => s.executed).map((s) => s.superTokenAddress),
              ),
            ),
          );
          const now = new Date();
          const flows = await Promise.all(
            streams.map(async (stream) => {
              if (stream.executed) {
                const decimals = superTokens[stream.superTokenAddress]?.decimals;
                const sfStream = sfStreams.find((s) => s.recipient.id === stream.to && s.token.id === stream.superTokenAddress);
                const nextFUEvent = sfStream.events.find((e, i) => i > 0 && sfStream.events[i - 1].transaction.blockNumber === stream.executedBlock);
                if (nextFUEvent) {
                // Stream was stopped or liquidated
                  const netFlow = +nextFUEvent.sum / (10 ** decimals);
                  return {
                    ...stream,
                    liquidated: stream.active,
                    netFlow,
                  };
                }
                const netFlow = stream.active ? (+stream.rate * ((now - new Date(stream.executedAt * 1000)) / 1000)) / (10 ** decimals)
                  : (+stream.rate * (+stream.canceledAt - +stream.executedAt)) / (10 ** decimals);
                return {
                  ...stream,
                  netFlow,
                };
              }
              return stream;
            }),

          );
          return {
            flows: flows.sort((a, b) => b.createdAt - a.createdAt),
            superTokens,
          };
        } catch (error) {
          console.error(error);
        }
      };
    }

    if (service === 'hasActiveStreams') {
      return async ({ to, tokenAddress }) => {
        const superfluidConfig = chainConfig.superfluid;
        if (!superfluidConfig) {
          throw Error(`Superfluid minion not available in ${chainID} network`);
        }
        const accountStreams = await graphQuery({
          endpoint: superfluidConfig.subgraph_url,
          query: SF_ACTIVE_STREAMS,
          variables: {
            ownerAddress: minion,
            recipientAddress: to.toLowerCase(),
          },
        });
        const activeStreams = accountStreams?.account?.flowsOwned;
        return !!activeStreams?.find((s) => s.token?.underlyingAddress === tokenAddress);
      };
    }
    if (service === 'getStream') {
      return async ({ proposalId }) => {
        const action = await minionContract.methods.streams(proposalId).call();
        return action;
      };
    }
    // proposeAction args: [ to, token, rate, minDeposit, ctx, details ]
    // executeAction args: [ proposal id ]
    // cancelAction args: [ proposal id ]
    // cancelStream args: [ proposal id ]
    // withdrawRemainingFunds args: | superToken |
    if (
      service === 'proposeStream'
      || service === 'executeAction'
      || service === 'cancelAction'
      || service === 'cancelStream'
      || service === 'withdrawRemainingFunds'
    ) {
      return async ({
        args, address, poll, onTxHash,
      }) => {
        const tx = await minionContract.methods[service](...args);
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
