import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import {
  Button,
  FormLabel,
  FormControl,
  Flex,
  Icon,
  Stack,
  Box,
  Select,
  Text,
} from '@chakra-ui/react';
import { useParams } from 'react-router-dom';
import { RiErrorWarningLine } from 'react-icons/ri';
import { AiOutlineCaretDown } from 'react-icons/ai';

import AddressInput from './addressInput';
import DetailsFields from './detailFields';
import PaymentInput from './paymentInput';
import RateInput from './rateInput';

import { useInjectedProvider } from '../contexts/InjectedProviderContext';
import { useDao } from '../contexts/DaoContext';
import { useUser } from '../contexts/UserContext';
import { useTX } from '../contexts/TXContext';
import { useOverlay } from '../contexts/OverlayContext';
import TextBox from '../components/TextBox';
import { SuperfluidMinionService } from '../services/superfluidMinionService';
import { createPoll } from '../services/pollService';
import { chainByID } from '../utils/chain';
import {
  daoConnectedAndSameChain,
  detailsToJSON,
  truncateAddr,
} from '../utils/general';
import { MINION_TYPES } from '../utils/proposalUtils';

const SuperfluidMinionProposalForm = () => {
  const [loading, setLoading] = useState(false);
  const { daoOverview } = useDao();
  const { daochain } = useParams();
  const {
    address,
    injectedChain,
    injectedProvider,
    requestWallet,
  } = useInjectedProvider();
  const { cachePoll, resolvePoll } = useUser();
  const {
    errorToast,
    successToast,
    setProposalModal,
    setTxInfoModal,
  } = useOverlay();
  const { refreshDao } = useTX();
  const [currentError, setCurrentError] = useState(null);
  const [minions, setMinions] = useState([]);
  const now = (new Date().getTime() / 1000).toFixed();

  const {
    handleSubmit,
    errors,
    register,
    setValue,
    getValues,
    watch,
  } = useForm();

  useEffect(() => {
    if (daoOverview?.minions) {
      const _minions = daoOverview.minions
        .filter((minion) => minion.minionType === MINION_TYPES.SUPERFLUID) // TODO: check if this is the right approach
        .sort((minionA, minionB) =>
          parseInt(minionA.createdAt) > parseInt(minionB.createdAt) ? 1 : -1,
        )
        .map((minion) => {
          return {
            // TODO: include agreement type
            address: minion.minionAddress,
            details: minion.details,
          };
        });
      setMinions(_minions);
    }
    // eslint-disable-next-line
  }, [daoOverview?.minions]);

  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      const newE = Object.keys(errors)[0];
      setCurrentError({
        field: newE,
        ...errors[newE],
      });
    } else {
      setCurrentError(null);
    }
  }, [errors]);

  const onSubmit = async (values) => {
    setLoading(true);

    const valueWei = injectedProvider.utils.toWei(values.paymentRequested);
    const details = detailsToJSON({
      title: values.title,
      description: values.description,
      link: values.link,
      recipient: values.memberApplicant || values.applicant,
      token: values.paymentToken,
      tokenRate: `${values.tokenRate} ${values.baseRate}`,
      ratePerSec: values.weiRatePerSec,
      minDeposit: valueWei,
    });
    const args = [
      values.memberApplicant || values.applicant,
      values.paymentToken,
      values.weiRatePerSec,
      valueWei,
      '0x',
      details,
    ];

    try {
      const poll = createPoll({ action: 'superfluidProposeAction', cachePoll })(
        {
          minionAddress: values.minionContract,
          createdAt: now,
          chainID: daochain,
          actions: {
            onError: (error, txHash) => {
              errorToast({
                title: `There was an error.`,
              });
              resolvePoll(txHash);
              console.error(`Could not find a matching proposal: ${error}`);
            },
            onSuccess: (txHash) => {
              successToast({
                title: 'Minion proposal submitted.',
              });
              refreshDao();
              resolvePoll(txHash);
            },
          },
        },
      );
      const onTxHash = () => {
        setProposalModal(false);
        setTxInfoModal(true);
      };
      await SuperfluidMinionService({
        web3: injectedProvider,
        minion: values.minionContract,
        chainID: daochain,
      })('proposeStream')({ args, address, poll, onTxHash });
    } catch (err) {
      setLoading(false);
      console.log('error: ', err);
    }
  };

  watch('paymentToken', '');

  return minions.length ? (
    <form onSubmit={handleSubmit(onSubmit)}>
      <FormControl
        isInvalid={errors.name}
        display='flex'
        flexDirection='row'
        justifyContent='space-between'
        mb={5}
        flexWrap='wrap'
      >
        <Box w={['100%', null, '50%']} pr={[0, null, 5]}>
          <Stack spacing={2}>
            <Box>
              <TextBox as={FormLabel} size='xs' htmlFor='minionContract'>
                Minion Contract
              </TextBox>
              <Select
                name='minionContract'
                icon={<AiOutlineCaretDown />}
                mb={5}
                focusBorderColor='secondary.500'
                ref={register({
                  required: {
                    value: true,
                    message: 'Superfluid Minion contract is required',
                  },
                })}
                placeholder='Select A Superfluid Agreement'
              >
                {' '}
                {minions.map((minion, idx) => (
                  <option key={idx} value={minion.address}>
                    {truncateAddr(minion.address) + ` (${minion.details})`}
                  </option>
                ))}
              </Select>
            </Box>
            <DetailsFields register={register} />
          </Stack>
        </Box>
        <Box w={['100%', null, '50%']}>
          <AddressInput
            formLabel='recipient'
            name='recipient'
            tipLabel='Address where tokens will be streamed'
            register={register}
            setValue={setValue}
            watch={watch}
          />
          <PaymentInput
            formLabel='Funds Requested'
            tipLabel='Select a token & minimum deposit to be sent to the Minion for streaming'
            register={register}
            setValue={setValue}
            getValues={getValues}
            errors={errors}
          />
          <RateInput
            register={register}
            setValue={setValue}
            getValues={getValues}
            tokenAddress={getValues('paymentToken')}
            errors={errors}
          />
        </Box>
      </FormControl>
      <Flex justify='flex-end' align='center' h='60px'>
        {currentError && (
          <Box color='secondary.300' fontSize='m' mr={5}>
            <Icon as={RiErrorWarningLine} color='secondary.300' mr={2} />
            {currentError.message}
          </Box>
        )}
        <Box>
          {daoConnectedAndSameChain(
            address,
            daochain,
            injectedChain?.chainId,
          ) ? (
            <Button
              type='submit'
              loadingText='Submitting'
              isLoading={loading}
              disabled={loading}
            >
              Submit
            </Button>
          ) : (
            <Button
              onClick={requestWallet}
              isDisabled={injectedChain && daochain !== injectedChain?.chainId}
            >
              Connect{' '}
              {injectedChain && daochain !== injectedChain?.chainId
                ? `to ${chainByID(daochain).name}`
                : 'Wallet'}
            </Button>
          )}
        </Box>
      </Flex>
    </form>
  ) : (
    <>
      <Text>You do not have a Superfluid minion yet</Text>
      <Text>In beta add a free Superfluid Minion Boost for your DAO</Text>
    </>
  );
};

export default SuperfluidMinionProposalForm;
