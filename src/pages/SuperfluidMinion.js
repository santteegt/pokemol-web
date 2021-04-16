import React, { useState, useEffect } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import {
  Flex,
  Box,
  Heading,
  Icon,
  useToast,
  Button,
  Avatar,
  Link,
  HStack,
  Stack,
  Skeleton,
  Text,
  Tooltip,
} from '@chakra-ui/react';
import { format } from 'date-fns';
import makeBlockie from 'ethereum-blockies-base64';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import { FaCopy } from 'react-icons/fa';
import { RiArrowLeftLine, RiQuestionLine } from 'react-icons/ri';
import { VscLinkExternal } from 'react-icons/vsc';

import { useInjectedProvider } from '../contexts/InjectedProviderContext';
import { useOverlay } from '../contexts/OverlayContext';
import { useTX } from '../contexts/TXContext';
import { useUser } from '../contexts/UserContext';

import AddressAvatar from '../components/addressAvatar';
import BankList from '../components/BankList';
import ContentBox from '../components/ContentBox';
import MainViewLayout from '../components/mainViewLayout';
import TextBox from '../components/TextBox';

import { createPoll } from '../services/pollService';
import { SuperfluidMinionService } from '../services/superfluidMinionService';

import { supportedChains } from '../utils/chain';
import { numberWithCommas, truncateAddr } from '../utils/general';
import { PROPOSAL_TYPES } from '../utils/proposalUtils';
import { initTokenData } from '../utils/tokenValue';

const SuperfluidMinionDetails = ({
  activities,
  overview,
  daoMember,
  members,
}) => {
  const [loading, setLoading] = useState({
    active: false,
    proposalId: null,
  });
  const [loadingStreams, setLoadingStreams] = useState(true);
  const { daochain, daoid, minion } = useParams();
  const toast = useToast();
  const [minionData, setMinionData] = useState();
  const [superTokenBalances, setSuperTokenBalances] = useState();
  const [minionBalances, setMinionBalances] = useState();
  const [streamList, setStreamList] = useState();
  const { address, injectedProvider } = useInjectedProvider();
  const {
    errorToast,
    successToast,
    setProposalModal,
    setTxInfoModal,
  } = useOverlay();
  const { refreshDao } = useTX();
  const { cachePoll, resolvePoll } = useUser();

  const network = supportedChains[daochain].network;

  const cancelStream = async (proposalId, isActive) => {
    const pollAction = isActive ? 'minionCancelAction' : 'cancelProposal';
    const action = isActive ? 'cancelStream' : 'cancelAction';

    setLoading({
      active: true,
      condition: proposalId,
    });
    try {
      const poll = createPoll({ action: pollAction, cachePoll })({
        minionAddress: minion,
        proposalId: proposalId,
        daoID: daoid,
        chainID: daochain,
        proposalType: PROPOSAL_TYPES.MINION_SUPERFLUID,
        actions: {
          onError: (error, txHash) => {
            errorToast({
              title: `There was an error.`,
            });
            resolvePoll(txHash);
            console.error(`Could not find a matching stream: ${error}`);
          },
          onSuccess: (txHash) => {
            successToast({
              title: 'Superfluid stream successfully cancelled.',
            });
            refreshDao();
            resolvePoll(txHash);
          },
        },
      });
      const onTxHash = () => {
        setProposalModal(false);
        setTxInfoModal(true);
      };
      const args = [proposalId];
      await SuperfluidMinionService({
        web3: injectedProvider,
        minion: minion,
        chainID: daochain,
      })(action)({ args, address, poll, onTxHash });
      setLoading({
        active: false,
        condition: null,
      });
    } catch (err) {
      setLoading({
        active: false,
        condition: null,
      });
      console.log('error: ', err);
    }
  };

  const withdrawSupertoken = async (tokenAddress) => {
    setLoading({
      active: true,
      condition: tokenAddress,
    });
    try {
      const poll = createPoll({
        action: 'superfluidWithdrawBalance',
        cachePoll,
      })({
        minionAddress: minion,
        superTokenAddress: tokenAddress,
        expectedBalance: 0,
        chainID: daochain,
        actions: {
          onError: (error, txHash) => {
            errorToast({
              title: `There was an error.`,
            });
            resolvePoll(txHash);
            console.error(`Could not withdraw the balance: ${error}`);
          },
          onSuccess: (txHash) => {
            successToast({
              title: 'Outstanding balance has been withdrawn.',
            });
            refreshDao();
            resolvePoll(txHash);
          },
        },
      });
      const onTxHash = () => {
        setProposalModal(false);
        setTxInfoModal(true);
      };
      const args = [tokenAddress];
      await SuperfluidMinionService({
        web3: injectedProvider,
        minion: minion,
        chainID: daochain,
      })('withdrawRemainingFunds')({ args, address, poll, onTxHash });
      setLoading({
        active: false,
        condition: null,
      });
    } catch (err) {
      setLoading({
        active: false,
        condition: null,
      });
      console.log('error: ', err);
    }
  };

  useEffect(() => {
    if (!overview?.minions.length) {
      return;
    }
    const _minionData = overview?.minions.find((m) => {
      return m.minionAddress === minion;
    });
    setMinionData(_minionData);
  }, [overview, minion]);

  useEffect(() => {
    if (daoid && minion && activities) {
      setLoadingStreams(true);
      const fetchStreams = async () => {
        const cfaStreams = await SuperfluidMinionService({
          minion: minion,
          chainID: daochain,
        })('fetchStreams')({ molochAddress: daoid });
        const streams = cfaStreams.flows.map((s) => {
          const proposal = activities?.proposals?.find(
            (p) => p.proposalId === s.proposalId,
          );
          if (proposal) {
            const details = JSON.parse(proposal.details);
            s.rateStr = details.tokenRate;
          }
          return s;
        });
        if (streams) {
          setSuperTokenBalances(cfaStreams.superTokens);
          setStreamList(streams);
        }
        setLoadingStreams(false);
      };
      fetchStreams();
    }
  }, [daoid, minion, activities]);

  useEffect(() => {
    const setUpBalances = async () => {
      const _minionBalances = members.find((member) => {
        if (member.memberAddress === minion) {
          return member.tokenBalances;
        }
      });
      let newTokenData;
      if (_minionBalances) {
        newTokenData = await initTokenData(_minionBalances.tokenBalances);
      } else {
        newTokenData = [];
      }
      setMinionBalances(newTokenData);
    };

    if (members) {
      setUpBalances();
    }
    // eslint-disable-next-line
  }, [members, minion]);

  return (
    <MainViewLayout header='Minion' isDao={true}>
      <Box>
        <Link as={RouterLink} to={`/dao/${daochain}/${daoid}/settings`}>
          <HStack spacing={3}>
            <Icon
              name='arrow-back'
              color='primary.50'
              as={RiArrowLeftLine}
              h='20px'
              w='20px'
            />
            <TextBox size='md' align='center'>
              {' '}
              Settings
            </TextBox>
          </HStack>
        </Link>
        <ContentBox d='flex' flexDirection='column' position='relative' mt={2}>
          {minionData ? (
            <>
              <Flex
                p={4}
                justify='space-between'
                align='center'
                key={minionData.minionAddress}
              >
                <Box>
                  <Flex align='center'>
                    <Avatar
                      name={minionData.minionAddress}
                      src={makeBlockie(minionData.minionAddress)}
                      mr={3}
                    />
                    <Heading>{minionData.details}</Heading>
                  </Flex>
                </Box>
                <Flex align='center'>
                  <TextBox size='md' colorScheme='whiteAlpha.900'>
                    {minionData.minionType}:{' '}
                    <Box as='span' color='primary.100'>
                      {truncateAddr(minionData.minionAddress)}
                    </Box>
                  </TextBox>
                  <CopyToClipboard
                    text={minionData.minionAddress}
                    onCopy={() =>
                      toast({
                        title: 'Copied Minion Address',
                        position: 'top-right',
                        status: 'success',
                        duration: 3000,
                        isClosable: true,
                      })
                    }
                  >
                    <Icon
                      as={FaCopy}
                      color='secondary.300'
                      ml={2}
                      _hover={{ cursor: 'pointer' }}
                    />
                  </CopyToClipboard>
                </Flex>
              </Flex>
              <Box>
                <Flex pt={4}>
                  <TextBox size='md'>Token Balances</TextBox>
                </Flex>
                {minionBalances ? (
                  <BankList
                    tokens={minionBalances}
                    hasBalance={false}
                    profile={true}
                  />
                ) : null}
              </Box>
              <Box>
                <Flex pt={4}>
                  <TextBox size='md'>Supertoken Balances</TextBox>
                </Flex>
                <ContentBox mt={6}>
                  <Flex>
                    <Box w={'15%'} d={['none', null, null, 'inline-block']}>
                      <TextBox size='xs'>Asset</TextBox>
                    </Box>
                    <Box w={['60%', null, null, '50%']}>
                      <TextBox size='xs'>{'Internal Bal.'}</TextBox>
                    </Box>
                    <Box w={'20%'} d={['none', null, null, 'inline-block']}>
                      <TextBox size='xs'>Actions</TextBox>
                    </Box>
                  </Flex>
                  <Skeleton isLoaded={!loadingStreams}>
                    {superTokenBalances
                      ? Object.keys(superTokenBalances).map(
                          (tokenAddress, i) => {
                            const token = superTokenBalances[tokenAddress];
                            return (
                              <Flex h='60px' align='center' key={i}>
                                <Box
                                  w={'15%'}
                                  d={['none', null, null, 'inline-block']}
                                >
                                  <Flex align='center'>
                                    <Box fontFamily='mono'>{token?.symbol}</Box>
                                    <CopyToClipboard
                                      text={tokenAddress}
                                      onCopy={() =>
                                        toast({
                                          title: 'Copied Address',
                                          position: 'top-right',
                                          status: 'success',
                                          duration: 3000,
                                          isClosable: true,
                                        })
                                      }
                                    >
                                      <Icon
                                        as={FaCopy}
                                        color='secondary.300'
                                        ml={2}
                                        _hover={{ cursor: 'pointer' }}
                                      />
                                    </CopyToClipboard>
                                  </Flex>
                                </Box>
                                <Box w={['60%', null, null, '50%']}>
                                  <Box fontFamily='mono'>
                                    {token.tokenBalance ? (
                                      <>
                                        {parseFloat(
                                          +token.tokenBalance /
                                            10 ** +token.decimals,
                                        )
                                          .toFixed(4)
                                          .toString()}{' '}
                                        {token.symbol}
                                      </>
                                    ) : null}
                                  </Box>
                                </Box>
                                {daoMember && (
                                  <Box
                                    w={['25%', null, null, '20%']}
                                    d={'inline-block'}
                                  >
                                    <Tooltip
                                      hasArrow
                                      shouldWrapChildren
                                      placement='top'
                                      label={
                                        token.tokenBalance > 0
                                          ? 'Outstanding balance will be downgraded and sent back to the DAO'
                                          : ''
                                      }
                                    >
                                      <Button
                                        rightIcon={<RiQuestionLine />}
                                        variant='solid'
                                        onClick={() =>
                                          withdrawSupertoken(tokenAddress)
                                        }
                                        loadingText={'Withdrawing'}
                                        isLoading={
                                          loading.active &&
                                          loading.condition === tokenAddress
                                        }
                                        disabled={
                                          token.tokenBalance <= 0 ||
                                          (loading.active &&
                                            loading.condition === tokenAddress)
                                        }
                                      >
                                        Withdraw
                                      </Button>
                                    </Tooltip>
                                  </Box>
                                )}
                              </Flex>
                            );
                          },
                        )
                      : null}
                  </Skeleton>
                </ContentBox>
              </Box>
              <Box>
                <Flex pt={4}>
                  <TextBox size='md'>Streams History</TextBox>
                </Flex>
                <ContentBox mt={6}>
                  <Flex>
                    <Box w={'15%'} d={['none', null, null, 'inline-block']}>
                      <TextBox size='xs'>Created At</TextBox>
                    </Box>
                    <Box w={['17%', null, null, '33%']}>
                      <TextBox size='xs'>To</TextBox>
                    </Box>
                    <Box w={'15%'} d={['none', null, null, 'inline-block']}>
                      <TextBox size='xs'>Rate</TextBox>
                    </Box>
                    <Box w={'15%'} d={['none', null, null, 'inline-block']}>
                      <TextBox size='xs'>Streamed</TextBox>
                    </Box>
                    <Box w={['30%', null, null, '15%']}>
                      <TextBox size='xs'>Actions</TextBox>
                    </Box>
                  </Flex>
                  <Skeleton isLoaded={!loadingStreams}>
                    {streamList?.length
                      ? streamList
                          .sort((a, b) => b.createdAt - a.createdAt)
                          .map((stream, i) => {
                            return (
                              <Flex h='60px' align='center' key={i}>
                                <Box
                                  w={'15%'}
                                  d={['none', null, null, 'inline-block']}
                                  fontFamily='mono'
                                >
                                  {format(
                                    new Date(+stream?.createdAt * 1000),
                                    'MMM. d, yyyy',
                                  ) || '--'}
                                </Box>
                                <Box w={'33%'}>
                                  <AddressAvatar
                                    addr={stream.to}
                                    hideCopy={true}
                                    alwaysShowName={true}
                                  />
                                </Box>
                                <Box w={'15%'} fontFamily='mono'>
                                  {stream.rateStr
                                    ? `${stream.rateStr}`
                                    : `${numberWithCommas(
                                        parseFloat(
                                          +stream.rate /
                                            10 **
                                              superTokenBalances[
                                                stream.superTokenAddress
                                              ].decimals,
                                        ).toFixed(10),
                                      )} per sec`}
                                </Box>
                                <Box w={'15%'}>
                                  {stream.executed ? (
                                    <Box fontFamily='mono'>
                                      {superTokenBalances[
                                        stream.superTokenAddress
                                      ] ? (
                                        <>
                                          {numberWithCommas(
                                            stream.netFlow.toFixed(4),
                                          )}{' '}
                                          {
                                            superTokenBalances[
                                              stream.superTokenAddress
                                            ].symbol
                                          }
                                        </>
                                      ) : null}
                                    </Box>
                                  ) : (
                                    <Box fontFamily='mono'>
                                      <Text fontFamily='mono'>Not started</Text>
                                    </Box>
                                  )}
                                </Box>
                                <Stack direction='row' spacing={4}>
                                  {daoMember && (
                                    <Tooltip
                                      hasArrow
                                      shouldWrapChildren
                                      placement='top'
                                      label={
                                        stream.active ? (
                                          <Box fontFamily='heading' p={5}>
                                            <TextBox mb={2}>
                                              GUILDKICK ALERT
                                            </TextBox>
                                            <Flex mb={2}>
                                              An unexpected cancelation of a
                                              stream would be punished with you
                                              being removed from the DAO.
                                            </Flex>
                                          </Box>
                                        ) : (
                                          ''
                                        )
                                      }
                                    >
                                      <Button
                                        rightIcon={<RiQuestionLine />}
                                        variant='solid'
                                        onClick={() =>
                                          cancelStream(
                                            stream.proposalId,
                                            stream.active || stream.executed,
                                          )
                                        }
                                        loadingText={
                                          !stream.executed
                                            ? 'Cancelling'
                                            : 'Stoppping'
                                        }
                                        isLoading={
                                          loading.active &&
                                          loading.condition ===
                                            stream.proposalId
                                        }
                                        disabled={
                                          !daoMember ||
                                          (stream.executed && !stream.active) ||
                                          (loading.active &&
                                            loading.condition ===
                                              stream.proposalId)
                                        }
                                      >
                                        Cancel
                                      </Button>
                                    </Tooltip>
                                  )}
                                  <Button
                                    leftIcon={<Icon as={VscLinkExternal} />}
                                    variant='outline'
                                    isDisabled={!stream.execTxHash}
                                  >
                                    <Link
                                      href={`https://app.superfluid.finance/streams/${network}/${stream.execTxHash}`}
                                      isExternal
                                    >
                                      View
                                    </Link>
                                  </Button>
                                </Stack>
                              </Flex>
                            );
                          })
                      : null}
                    {!streamList?.length && (
                      <Text fontFamily='mono' mt='5'>
                        No streams have been created
                      </Text>
                    )}
                  </Skeleton>
                </ContentBox>
              </Box>
            </>
          ) : (
            <Flex justify='center'>
              <Box fontFamily='heading'>No minion found</Box>
            </Flex>
          )}
        </ContentBox>
      </Box>
    </MainViewLayout>
  );
};

export default SuperfluidMinionDetails;
