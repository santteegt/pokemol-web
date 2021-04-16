import Web3 from 'web3';

import SuperfluidMinionFactory from '../contracts/superfluidMinionFactory.json';
import { chainByID } from '../utils/chain';

export const SuperfluidMinionFactoryService = ({ web3, chainID }) => {
  if (!web3) {
    const rpcUrl = chainByID(chainID).rpc_url;
    web3 = new Web3(new Web3.providers.HttpProvider(rpcUrl));
  }

  const chainParams = chainByID(chainID);

  const factory = new web3.eth.Contract(
    SuperfluidMinionFactory,
    chainParams.superfluid_minion_factory_addr,
  );
  return (service) => {
    if (service === 'summonSuperfluidMinion') {
      return async ({ args, from, poll, onTxHash }) => {
        try {
          // const agreementType = args[2]; // TODO: cfa or ida
          const version = args[3];
          const superAppAddress =
            chainParams.superfluid_super_app &&
            chainParams.superfluid_super_app[version];
          if (superAppAddress && chainParams.superfluid_minion_factory_addr) {
            const params = [args[0], superAppAddress, args[1]];

            const tx = await factory.methods.summonMinion(...params);
            return tx
              .send({ from })
              .on('transactionHash', (txHash) => {
                if (poll) {
                  onTxHash(txHash);
                  poll(txHash);
                }
              })
              .on('error', (error) => {
                console.error(error);
              });
          }
        } catch (error) {
          return error;
        }
      };
    }
  };
};
